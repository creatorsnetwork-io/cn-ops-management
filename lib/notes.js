// Reads Gemini meeting notes out of Drive and turns them into a recap a human approves.
//
// Two rules govern this file.
// Nothing here writes to a brand brain or a decision log on its own. It drafts, a
// person accepts. And it never invents: if the notes do not say something, the field
// comes back empty rather than plausible.

import { google } from 'googleapis';
import { auth } from './google';
import { sanity } from './sanity';
import { chat, HOUSE } from './ai';
import { cachedDoc } from './sheetcache';

const NOTES_SUFFIX = 'Notes by Gemini';
const DOC_MIME = 'application/vnd.google-apps.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

function drive() {
  return google.drive({ version: 'v3', auth: auth() });
}

// Which Google Meet folders to walk. One per person, because Gemini writes notes
// into the meeting organiser's own Drive and there is no way to redirect that.
export async function noteFolders() {
  const s = await cachedDoc('settings.notes', 60 * 1000, () =>
    sanity(true).fetch('*[_id=="settings.notes"][0]{folders}'));
  return ((s && s.folders) || []).filter((f) => f && f.id);
}

// A Drive listing of every meeting folder and the notes document inside it.
// Shortcuts are followed to the real file, which is how a meeting someone else
// organised shows up in this folder at all.
export async function scanFolder(folderId, limit) {
  const d = drive();
  const meetings = await d.files.list({
    q: `'${folderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: limit || 40,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const out = [];
  for (const m of meetings.data.files || []) {
    const kids = await d.files.list({
      q: `'${m.id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,shortcutDetails(targetId,targetMimeType))',
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const k of kids.data.files || []) {
      if (!String(k.name || '').includes(NOTES_SUFFIX)) continue;
      const shortcut = k.mimeType === SHORTCUT_MIME;
      const targetId = shortcut ? (k.shortcutDetails || {}).targetId : k.id;
      const targetMime = shortcut ? (k.shortcutDetails || {}).targetMimeType : k.mimeType;
      if (!targetId || targetMime !== DOC_MIME) continue;
      // A shortcut points at a file in someone else's Drive. Ask now whether we can
      // actually open it, so the screen never offers a button that cannot work.
      let readable = !shortcut;
      let blocked = '';
      if (shortcut) {
        try { await d.files.get({ fileId: targetId, fields: 'id', supportsAllDrives: true }); readable = true; }
        catch (e) { blocked = 'Hosted by someone else, and their Google Meet folder is not shared with the portal yet.'; }
      }
      out.push({
        driveId: targetId,
        title: String(k.name).replace(' - ' + NOTES_SUFFIX, '').trim(),
        meetingFolder: m.name,
        meetingAt: isoFromTitle(k.name) || m.createdTime,
        viaShortcut: shortcut,
        readable, blocked,
      });
    }
  }
  // The same meeting can appear twice when a recurring call produces two note docs.
  const seen = new Set();
  return out.filter((x) => (seen.has(x.driveId) ? false : (seen.add(x.driveId), true)));
}

// Gemini puts the real meeting time in the filename. Trust that over the folder's
// created time, which is when Drive happened to write the file.
export function isoFromTitle(name) {
  const m = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(String(name || ''));
  if (!m) return '';
  // The stamp is IST in every sample seen. Recorded as UTC so ordering is honest.
  const ist = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - (5.5 * 60 * 60 * 1000);
  return new Date(ist).toISOString();
}

export async function docText(driveId) {
  const res = await drive().files.export({ fileId: driveId, mimeType: 'text/plain' });
  return String(res.data || '');
}

// ---------------------------------------------------------------------------
// Matching a meeting to a client
// ---------------------------------------------------------------------------

const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const INTERNAL = ['cnoperations', 'cnops', 'internal', 'standup', 'teammeeting', 'weeklyreview', 'allhands'];

// Words that identify nobody on their own.
const NOISE = new Set(['the', 'and', 'group', 'international', 'global', 'ltd', 'limited', 'pvt', 'private', 'company', 'co', 'llc', 'inc']);

export function keysFor(c) {
  const keys = new Set();
  if (c.code) keys.add(squash(c.code));
  if (c.slug) keys.add(squash(c.slug));
  for (const a of c.aliases || []) if (a) keys.add(squash(a));
  const words = String(c.name || '').split(/\s+/).filter((w) => w.length > 2 && !NOISE.has(w.toLowerCase()));
  if (words.length) keys.add(squash(words.join('')));
  for (const w of words) if (w.length > 3) keys.add(squash(w));
  // Initials, so "Elite Global Concierge" answers to "EGC".
  if (words.length > 1) keys.add(squash(words.map((w) => w[0]).join('')));
  keys.delete('');
  return [...keys];
}

// Returns the client and project a meeting belongs to, or says it could not tell.
// Deliberately conservative: a wrong client is worse than an unmatched one.
export function matchMeeting(title, clients, projects) {
  const t = squash(title);
  if (!t) return { clientSlug: '', projectSlug: '', internal: false, why: 'The meeting has no title.' };

  for (const marker of INTERNAL)
    if (t.includes(marker)) return { clientSlug: '', projectSlug: '', internal: true, why: 'Reads as an internal CN meeting.' };

  const hits = [];
  for (const c of clients || []) {
    for (const k of keysFor(c)) {
      if (k.length >= 3 && t.includes(k)) { hits.push({ slug: c.slug, name: c.name, on: k }); break; }
    }
  }

  if (!hits.length) return { clientSlug: '', projectSlug: '', internal: false, why: 'No client name or code in the title.' };
  if (hits.length > 1)
    return { clientSlug: '', projectSlug: '', internal: false,
      why: 'The title names more than one client: ' + hits.map((h) => h.name).join(' and ') + '. Pick one.' };

  const client = hits[0];
  const mine = (projects || []).filter((p) => p.clientSlug === client.slug);
  let projectSlug = '';
  if (mine.length === 1) projectSlug = mine[0].slug;
  else {
    const named = mine.find((p) => {
      const words = String(p.name || '').split(/\s+/).filter((w) => w.length > 3 && !NOISE.has(w.toLowerCase()));
      return words.some((w) => t.includes(squash(w)));
    });
    if (named) projectSlug = named.slug;
  }
  return {
    clientSlug: client.slug, projectSlug, internal: false,
    why: 'Matched on "' + client.on + '" in the title.' + (projectSlug ? '' : ' Project not obvious, pick one.'),
  };
}

// ---------------------------------------------------------------------------
// The recap
// ---------------------------------------------------------------------------

const SIX = ['decided', 'changed', 'rejected', 'tone', 'scope', 'open'];

const RECAP_SYSTEM = `You read the notes from one client meeting at a boutique B2B marketing agency and fill six fields.

${HOUSE}

Return JSON only, shaped exactly:
{
  "decided":  ["one decision per line"],
  "changed":  ["what changed from what was agreed before"],
  "rejected": ["what the client rejected, and why if they said why"],
  "tone":     ["preferences about voice, wording or style. words they used. things they disliked"],
  "scope":    ["work implied that may sit outside the current retainer"],
  "open":     [{"q": "the open question", "owner": "the name in the notes, or empty"}],
  "summary":  "two sentences, plain, no adjectives that were not earned"
}

Hard rules:
- Only what the notes actually say. An empty array is the correct answer when the notes are silent. Never fill a field to look thorough.
- Quote or closely paraphrase. Do not summarise a decision into something more decisive than it was.
- "decided" means someone chose something. Discussion is not a decision.
- "tone" is the field that teaches the system how this client sounds. Be literal: the actual words they liked or objected to.
- Do not name a person as owner unless the notes name them.`;

export async function recapFrom(text, clientName) {
  const body = String(text || '').slice(0, 40000);
  if (body.trim().length < 40) throw new Error('That notes document is effectively empty.');

  const r = await chat({
    json: true,
    maxTokens: 1800,
    system: RECAP_SYSTEM,
    user: 'Client: ' + (clientName || 'not identified') + '\n\nThe meeting notes:\n\n' + body,
  });

  let parsed = null;
  try { parsed = JSON.parse(r.text); } catch (e) {
    throw new Error('The model did not return usable JSON. Try again.');
  }

  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12) : []);
  const out = { summary: String(parsed.summary || '').trim(), model: r.model };
  for (const f of SIX) {
    if (f === 'open') {
      out.open = (Array.isArray(parsed.open) ? parsed.open : [])
        .map((x) => ({ q: String((x && x.q) || '').trim(), owner: String((x && x.owner) || '').trim() }))
        .filter((x) => x.q).slice(0, 12);
    } else out[f] = list(parsed[f]);
  }
  out.empty = SIX.every((f) => !(out[f] || []).length);
  return out;
}

// What a recap offers the brand brain. Kept separate from the recap itself because
// a decision is a fact about one week and a voice rule is a change to the client.
export function proposalsFrom(recap) {
  return (recap.tone || []).map((t, i) => ({ _key: 'p' + i, kind: 'voice', text: t, state: 'waiting' }));
}
