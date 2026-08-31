// The brand brain: a structured record of how a client's brand sounds and looks,
// separate from the free-text voice note in Settings. Built so a document can be
// uploaded or a Drive link pasted, and the fields proposed from it rather than
// typed by hand. Nothing here writes to a project on its own. A person reviews
// the proposal and decides, field by field, what to keep.

import { chat, HOUSE } from './ai';
import { driveFileId, driveFileMeta, downloadDriveFile } from './google';
import { docText } from './notes';
import { textFromFile } from './readdoc';

export const BRAND_FIELDS = [
  { key: 'positioning', label: 'Positioning', kind: 'text',
    note: 'Who this is for and what it promises them. One or two sentences.' },
  { key: 'voiceIs', label: 'The voice is', kind: 'list',
    note: 'Short traits, one per line. How it actually sounds.' },
  { key: 'voiceIsNot', label: 'The voice is never', kind: 'list',
    note: 'The opposite of the above. What it deliberately avoids sounding like.' },
  { key: 'neverSay', label: 'Never say', kind: 'list',
    note: 'Specific words or phrases this brand does not use.' },
  { key: 'always', label: 'Always available', kind: 'list',
    note: 'Facts, proof points or phrases that are always safe to reach for.' },
  { key: 'visual', label: 'Visual direction', kind: 'text',
    note: 'Palette, imagery style and mood, in a sentence or two.' },
];

const LIST_KEYS = BRAND_FIELDS.filter((f) => f.kind === 'list').map((f) => f.key);
const TEXT_KEYS = BRAND_FIELDS.filter((f) => f.kind === 'text').map((f) => f.key);

// A pasted link resolves to plain text the same way whether it is a Google Doc
// (exported directly, the way meeting notes already are) or a PDF/Word file
// sitting in Drive (downloaded, then read the same way an upload would be).
export async function textFromLink(link) {
  const fileId = driveFileId(link);
  if (!fileId)
    throw new Error('That does not look like a Google Drive or Google Docs link. Paste the share link, or upload the file instead.');
  const meta = await driveFileMeta(fileId);
  if (meta.mimeType === 'application/vnd.google-apps.document') {
    const text = await docText(fileId);
    return { text, how: 'google doc', filename: meta.name };
  }
  const buf = await downloadDriveFile(fileId);
  const { text, how } = await textFromFile(buf, meta.name, meta.mimeType);
  return { text, how, filename: meta.name };
}

const SYSTEM = `You read a brand brief or reference document for a boutique B2B marketing agency's client, and pull out only what it actually says about how that brand should sound and look. This proposes updates to a structured brand record. A person reviews every field before anything is kept.

${HOUSE}

Return JSON only, shaped exactly:
{
  "positioning": "one or two sentences: who this is for and what it promises them, or empty if the document does not say",
  "voiceIs": ["a short phrase describing how the voice actually sounds, one trait per entry"],
  "voiceIsNot": ["a short phrase describing what the voice deliberately avoids, one trait per entry"],
  "neverSay": ["a specific word or phrase the document says not to use"],
  "always": ["a fact, proof point or phrase the document says is safe or good to reach for"],
  "visual": "one paragraph: palette, imagery style and mood, or empty if the document does not say"
}

Hard rules:
- Only what the document actually states. An empty string or empty array is the correct answer when it is silent on that field. Never fill a field to look thorough.
- Quote or closely paraphrase the document's own wording, especially for neverSay and voiceIsNot, which briefs usually already write as an "avoid" list.
- Do not invent a positioning statement, a palette, a font or an image style the document does not name.
- neverSay is words and short phrases, not full sentences.
- Keep every list entry under 15 words.`;

export async function proposeBrand({ text, projectName, clientName }) {
  const body = String(text || '').slice(0, 60000);
  if (body.trim().length < 40) throw new Error('That document is effectively empty.');

  const out = await chat({
    json: true, maxTokens: 1500,
    system: SYSTEM,
    user: 'Client: ' + (clientName || 'not identified') + '\nProject: ' + (projectName || 'not identified') + '\n\nThe document:\n\n' + body,
  });

  let parsed;
  try { parsed = JSON.parse(out.text); }
  catch (e) { throw new Error('The read came back in a shape I could not use.'); }

  return { proposal: cleanBrand(parsed), model: out.model };
}

// Shared by the AI proposal and the save endpoint, so a saved value is shaped
// the same way whichever path it came from.
export function cleanBrand(b) {
  b = b || {};
  const out = {};
  for (const k of TEXT_KEYS) out[k] = String(b[k] || '').trim().slice(0, 1200);
  for (const k of LIST_KEYS) {
    out[k] = (Array.isArray(b[k]) ? b[k] : String(b[k] || '').split('\n'))
      .map((x) => String(x || '').trim().slice(0, 140))
      .filter(Boolean)
      .slice(0, 40);
  }
  return out;
}

// What a client's brand renders as inside an AI drafting prompt. Additive to
// the existing per-project free-text voice note, not a replacement for it.
export function brandBlock(p) {
  const b = (p && p.brand) || {};
  const lines = [];
  if (b.positioning) lines.push('Positioning: ' + b.positioning);
  if ((b.voiceIs || []).length) lines.push('The voice is: ' + b.voiceIs.join(', '));
  if ((b.voiceIsNot || []).length) lines.push('The voice is never: ' + b.voiceIsNot.join(', '));
  if ((b.neverSay || []).length) lines.push('Never say: ' + b.neverSay.join(', '));
  if ((b.always || []).length) lines.push('Always safe to use: ' + b.always.join(', '));
  if (b.visual) lines.push('Visual direction: ' + b.visual);
  return lines.join('\n');
}
