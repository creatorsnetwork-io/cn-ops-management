import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { readProjectWeek, log } from '../../../lib/week';
import { chat, HOUSE, LIMITS_TEXT } from '../../../lib/ai';
import { checkWeekImages } from '../../../lib/imagecheck';
import { brandBlock } from '../../../lib/brand';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

// Drafts only. Nothing here writes to a sheet, and nothing here decides anything.
// Everything produced is stored as a draft with who asked for it and when.

// The model will happily call "IG" Instagram. Match what comes back to the
// column names in the sheet rather than insisting it echoes them exactly.
const ALIAS = {
  instagram: ['instagram', 'ig', 'insta'],
  facebook: ['facebook', 'fb'],
  linkedin: ['linkedin', 'linkedinn', 'li'],
  x: ['x', 'twitter'],
  threads: ['threads'],
  youtube: ['youtube', 'yt'],
  tiktok: ['tiktok'],
};
function chKey(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  for (const k of Object.keys(ALIAS)) if (ALIAS[k].includes(n)) return k;
  return n;
}
function pickCaption(parsed, channel) {
  if (!parsed) return '';
  const want = chKey(channel);
  for (const k of Object.keys(parsed)) {
    if (chKey(k) === want) return String(parsed[k] || '');
  }
  return '';
}

async function voiceOf(slug) {
  const p = await sanity(true).fetch(
    // Brand lives on the client, shared across all of that client's projects.
    // Voice stays per project, it is a narrower note than the brand brain.
    `*[_type=="project" && slug==$s][0]{name,voice,extraBanned,"client":client->{name,note,brand}}`, { s: slug });
  return p || {};
}

function voiceBlock(p) {
  const lines = [];
  lines.push('Client: ' + ((p.client && p.client.name) || 'unknown'));
  lines.push('Project: ' + (p.name || 'unknown'));
  if (p.voice) lines.push('How this client sounds:\n' + p.voice);
  else lines.push('No voice has been written for this client yet. Stay neutral, plain and specific, and do not invent a personality.');
  // The brand brain, when one has been filled in. Lives on the client, so
  // every project under them reads the same one. Additive to the note above,
  // not a replacement for it.
  const bb = brandBlock(p.client);
  if (bb) lines.push('Brand brain:\n' + bb);
  if ((p.extraBanned || []).length) lines.push('Words this client has banned: ' + p.extraBanned.join(', '));
  return lines.join('\n');
}

export async function POST(req) {
  const who = meSlug();
  const rights = await can(who, 'generate');
  if (rights === 'no') return Response.json({ ok: false, error: 'Your role does not draft content.' }, { status: 403 });

  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    // Captions for one row of a calendar, one per channel that row needs.
    if (b.action === 'captions') {
      const w = await readProjectWeek(b.slug, b.week);
      if (w.error) return Response.json({ ok: false, error: w.error });
      const item = w.items.find((x) => x.key === b.key);
      if (!item) return Response.json({ ok: false, error: 'That row is no longer in the calendar.' }, { status: 400 });

      const p = await voiceOf(b.slug);
      const channels = (item.captions || []).filter((x) => b.onlyEmpty === false || !x.has).map((x) => x.channel);
      if (!channels.length) return Response.json({ ok: false, error: 'Every caption on that row is already written. Use Redraft if you want them replaced.' });

      const written = (item.captions || []).filter((x) => x.has).map((x) => x.channel + ': ' + x.text).join('\n\n');

      const out = await chat({
        json: true,
        system: `You write social copy for a boutique B2B agency. ${HOUSE}\n\n${LIMITS_TEXT}\n\nReturn JSON only, shaped {"captions": {"<channel name>": "<the caption>"}}. Use exactly the channel names you are given.`,
        user: `${voiceBlock(p)}

The post:
Date: ${item.date || 'not set'}
Format: ${item.type || 'not stated'}
Idea: ${item.title || 'not stated'}
${item.remarks ? 'Notes on the sheet: ' + item.remarks : ''}
${written ? '\nCaptions already written for other channels, match their voice and do not repeat them word for word:\n' + written : ''}
${b.guidance ? '\nThe person asking for this draft added this note, follow it, it overrides anything above that conflicts with it:\n' + String(b.guidance).slice(0, 400) : ''}

Write a caption for each of these channels: ${channels.join(', ')}.
Each one should read as if written for that channel, not copied between them.`,
      });

      let parsed = {};
      try { parsed = JSON.parse(out.text).captions || {}; } catch (e) {
        return Response.json({ ok: false, error: 'The draft came back in a shape I could not read. Try again.' });
      }

      const drafts = [];
      for (const ch of channels) {
        const text = pickCaption(parsed, ch).trim();
        if (!text) continue;
        const doc = await c.create({
          _type: 'draft', at: now, by: who, kind: 'caption',
          projectSlug: b.slug, week: w.week, itemKey: b.key, channel: ch,
          text, model: out.model, status: 'new',
          col: ((item.captions || []).find((x) => x.channel === ch) || {}).col ?? null,
          sheetRow: item.sheetRow, tab: w.tab,
        });
        drafts.push({ _id: doc._id, channel: ch, text });
      }
      await log(who, 'Drafted captions', b.slug + ':' + b.key, channels.join(', ') + ' via ' + out.model);
      const missed = channels.filter((ch) => !drafts.some((d) => d.channel === ch));
      return Response.json({ ok: true, drafts, model: out.model,
        warning: missed.length ? 'Nothing came back for ' + missed.join(' and ') + '. Try again.' : null });
    }

    // Ideas for a week, for rows that have no idea written yet.
    if (b.action === 'week') {
      const w = await readProjectWeek(b.slug, b.week);
      if (w.error) return Response.json({ ok: false, error: w.error });
      const p = await voiceOf(b.slug);
      const blank = w.items.filter((i) => !i.title || !i.title.trim());
      const already = w.items.filter((i) => i.title).map((i) => (i.date || '') + ' ' + i.type + ': ' + i.title).join('\n');

      if (!blank.length) return Response.json({ ok: false, error: 'Every row this week already has an idea against it.' });

      const out = await chat({
        json: true,
        system: `You plan content for a boutique B2B agency. ${HOUSE}\n\nReturn JSON only, shaped {"ideas": [{"row": <sheet row number>, "idea": "<one line>"}]}.`,
        user: `${voiceBlock(p)}

These rows in the calendar have a format and a date but no idea yet:
${blank.map((i) => 'row ' + i.sheetRow + ': ' + (i.date || 'no date') + ', ' + (i.type || 'format not stated')).join('\n')}

${already ? 'Ideas already planned this week, do not repeat or paraphrase them:\n' + already : ''}

Give one idea per row. One line each, concrete and specific, something a real client would recognise as theirs.`,
      });

      let ideas = [];
      try { ideas = JSON.parse(out.text).ideas || []; } catch (e) {
        return Response.json({ ok: false, error: 'The plan came back in a shape I could not read. Try again.' });
      }

      const drafts = [];
      for (const it of ideas) {
        const item = blank.find((x) => x.sheetRow === Number(it.row));
        if (!item || !String(it.idea || '').trim()) continue;
        const doc = await c.create({
          _type: 'draft', at: now, by: who, kind: 'idea',
          projectSlug: b.slug, week: w.week, itemKey: item.key, channel: 'Idea',
          text: String(it.idea).trim(), model: out.model, status: 'new',
          col: w.items.length ? null : null, sheetRow: item.sheetRow, tab: w.tab,
        });
        drafts.push({ _id: doc._id, itemKey: item.key, sheetRow: item.sheetRow, text: String(it.idea).trim() });
      }
      await log(who, 'Drafted a week of ideas', b.slug + ':' + w.week, drafts.length + ' rows via ' + out.model);
      return Response.json({ ok: true, drafts, model: out.model });
    }

    // A brief for a work item.
    if (b.action === 'brief') {
      const item = await sanity(true).fetch(
        `*[_id==$id][0]{_id,title,kind,brief,acceptance,"projectSlug":project->slug,"projectName":project->name,"client":project->client->name}`,
        { id: b.id });
      if (!item) return Response.json({ ok: false, error: 'That work item no longer exists.' }, { status: 404 });
      const p = await voiceOf(item.projectSlug);

      const out = await chat({
        json: true,
        system: `You write work briefs for a boutique agency. ${HOUSE}\n\nReturn JSON only, shaped {"brief": "<the brief>", "acceptance": "<one line, what counts as done>"}. The brief should be short enough to read in under a minute and specific enough that two people would build the same thing.`,
        user: `${voiceBlock(p)}

Work item: ${item.title}
Kind: ${item.kind}
${item.brief ? 'What is written so far, improve on it rather than ignoring it:\n' + item.brief : 'Nothing is written yet.'}

Write the brief and a single line for what counts as done. Do not invent client facts. Where something must be decided by a human, say so in square brackets.`,
      });

      let parsed = {};
      try { parsed = JSON.parse(out.text); } catch (e) {
        return Response.json({ ok: false, error: 'The brief came back in a shape I could not read.' });
      }
      const doc = await c.create({
        _type: 'draft', at: now, by: who, kind: 'brief',
        workId: item._id, projectSlug: item.projectSlug, channel: 'Brief',
        text: String(parsed.brief || '').trim(),
        acceptance: String(parsed.acceptance || '').trim(),
        model: out.model, status: 'new',
      });
      await log(who, 'Drafted a brief', item._id, 'via ' + out.model);
      return Response.json({ ok: true, draft: { _id: doc._id, text: parsed.brief, acceptance: parsed.acceptance }, model: out.model });
    }

    // Advisory only. Stored separately from the deterministic flags so it can
    // never reach the ship gate, no matter what it says.
    if (b.action === 'tone') {
      const w = await readProjectWeek(b.slug, b.week);
      if (w.error) return Response.json({ ok: false, error: w.error });
      const p = await voiceOf(b.slug);
      const written = w.items.filter((i) => (i.captions || []).some((x) => x.has));
      if (!written.length) return Response.json({ ok: false, error: 'Nothing is written yet this week, so there is nothing to read.' });

      const body = written.map((i) => {
        const caps = (i.captions || []).filter((x) => x.has).map((x) => x.channel + ': ' + x.text).join('\n');
        return 'row ' + i.sheetRow + ' (' + (i.type || 'post') + ', ' + (i.title || 'no idea written') + ')\n' + caps;
      }).join('\n\n---\n\n');

      const out = await chat({
        json: true, maxTokens: 2000,
        system: `You are a brand editor reading copy before it goes to a client. ${HOUSE}

You are advisory. You cannot stop anything. Say less rather than more: only flag something if a careful editor would actually raise it. If a post reads well, say nothing about it.
Return JSON only, shaped {"notes":[{"row": <sheet row number>, "channel": "<channel or empty>", "note": "<one sentence, what is off and what to do>"}]}. Return an empty list if nothing is worth raising.`,
        user: `${voiceBlock(p)}

The copy:

${body}`,
      });

      let notes = [];
      try { notes = JSON.parse(out.text).notes || []; } catch (e) {
        return Response.json({ ok: false, error: 'The read came back in a shape I could not use.' });
      }

      const byRow = {};
      for (const i of w.items) byRow[i.sheetRow] = i;
      const toneFlags = notes.map((n, idx) => {
        const it = byRow[Number(n.row)] || {};
        return {
          _key: 't' + idx, key: it.key || String(n.row), channel: String(n.channel || ''),
          note: String(n.note || '').slice(0, 400),
          label: [it.date, it.type, it.title].filter(Boolean).join(' · ') || ('row ' + n.row),
        };
      }).filter((x) => x.note);

      await c.createIfNotExists({ _id: 'week.' + b.slug + '.' + w.week, _type: 'weekReview', projectSlug: b.slug, week: w.week, items: [], flags: [] });
      await c.patch('week.' + b.slug + '.' + w.week)
        .set({ toneFlags, toneAt: now, toneBy: who, toneModel: out.model }).commit();
      await log(who, 'Read the week for tone', b.slug + ':' + w.week, toneFlags.length + ' notes via ' + out.model);
      return Response.json({ ok: true, count: toneFlags.length, model: out.model });
    }

    if (b.action === 'image') {
      const w = await readProjectWeek(b.slug, b.week);
      if (w.error) return Response.json({ ok: false, error: w.error });

      const result = await checkWeekImages(w.items);

      await c.createIfNotExists({ _id: 'week.' + b.slug + '.' + w.week, _type: 'weekReview', projectSlug: b.slug, week: w.week, items: [], flags: [] });
      await c.patch('week.' + b.slug + '.' + w.week)
        .set({ imageFlags: result.flags, imageAt: now, imageBy: who }).commit();
      await log(who, 'Checked images against captions', b.slug + ':' + w.week,
        result.flags.length + ' note(s), ' + result.checked + ' checked, ' + result.cached + ' cached, ' + result.skipped + ' skipped of ' + result.total);
      return Response.json({ ok: true, count: result.flags.length, checked: result.checked, cached: result.cached, skipped: result.skipped, total: result.total });
    }

    if (b.action === 'discard') {
      await c.patch(b.id).set({ status: 'discarded', discardedBy: who, discardedAt: now }).commit();
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 260) });
  }
}
