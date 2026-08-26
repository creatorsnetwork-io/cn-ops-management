// Checks a week's static images and PDF carousels: does each slide's photo
// match a place the caption names, and is there an actual typo or broken
// sentence in whatever text sits on the slide. Deliberately its own pass, not
// folded into lib/qc.js, because this one costs real money per slide and the
// team should decide when that gets spent, not have it fire on every re-check.
//
// No video yet, on purpose. Carousels arrive as one PDF per row today, not a
// Drive folder, so that is the only "many slides in one row" shape handled.

import { sanity } from './sanity';
import { driveFileId, driveFileMeta, downloadDriveFile } from './google';
import { mediaToSlides } from './pdfrender';
import { checkSlide, CHECK_PROMPT_VERSION } from './ai';

const cacheId = (fileId) => 'imgcache.' + fileId;

// A file's modified time changes if someone swaps its content while keeping
// the same Drive link, so caching on the link alone would go stale silently.
async function cachedSlides(fileId, modifiedTime) {
  const doc = await sanity(true).fetch('*[_id==$id][0]{modifiedTime,promptVersion,slides}', { id: cacheId(fileId) });
  // A prompt change invalidates old cached results too, not just a changed file,
  // so a wording fix actually reaches anything checked under the old wording.
  if (doc && doc.modifiedTime === modifiedTime && doc.promptVersion === CHECK_PROMPT_VERSION) return doc.slides || null;
  return null;
}
async function saveCache(fileId, modifiedTime, slides) {
  const c = sanity(true);
  await c.createIfNotExists({ _id: cacheId(fileId), _type: 'imageCheckCache' });
  await c.patch(cacheId(fileId)).set({ modifiedTime, promptVersion: CHECK_PROMPT_VERSION, slides, checkedAt: new Date().toISOString() }).commit();
}

function captionText(item) {
  const caps = (item.captions || []).filter((c) => c.has);
  return caps.length ? caps.map((c) => c.channel + ': ' + c.text).join('\n').slice(0, 800) : '';
}

// One row's result, or null if there was nothing this can check (no link,
// no destination named anywhere, or a media type this does not handle yet).
async function checkItem(item) {
  const link = item.creativeLink;
  if (!link) return null;
  const fileId = driveFileId(link);
  if (!fileId) return null;

  let meta;
  try { meta = await driveFileMeta(fileId); }
  catch (e) { return { key: item.key, error: 'Could not read this file from Drive: ' + (e.message || e) }; }

  const mimeType = meta.mimeType || item.creativeMime || '';
  let slides = await cachedSlides(fileId, meta.modifiedTime);
  let fromCache = !!slides;

  if (!slides) {
    let buf;
    try { buf = await downloadDriveFile(fileId); }
    catch (e) { return { key: item.key, error: 'Could not download this file: ' + (e.message || e) }; }

    let raw;
    try { raw = await mediaToSlides(buf, mimeType); }
    catch (e) { return { key: item.key, error: 'Could not open this file: ' + (e.message || e) }; }
    if (!raw) return null; // video, or something else not handled yet

    const caption = captionText(item);
    slides = [];
    for (const s of raw) {
      const r = await checkSlide({ imageBuffer: s.jpeg, caption, embeddedText: s.embeddedText });
      slides.push({ page: s.page, ...r });
    }
    await saveCache(fileId, meta.modifiedTime, slides);
  }

  return { key: item.key, fileId, fromCache, slides };
}

// Turns per-slide AI results into the same shaped notes the tone check
// already produces, so the existing UI needs nothing new to show them.
function toNotes(item, result) {
  if (!result) return [];
  if (result.error) return [{ channel: '', note: result.error }];
  const notes = [];
  for (const s of result.slides || []) {
    const bits = [];
    if (s.placeMatch === 'no') bits.push('Photo does not match the destination named in the caption' + (s.whatItShows ? ' (shows ' + s.whatItShows + ')' : '') + '.');
    if ((s.textIssues || []).length) bits.push('Text on the slide: ' + s.textIssues.join('; ') + '.');
    if (bits.length) notes.push({ channel: (result.slides.length > 1 ? 'slide ' + s.page : ''), note: bits.join(' ') });
  }
  return notes;
}

// Only rows with a creative link and at least one written caption are worth
// the spend, same filter the tone check already uses for its own pass.
export async function checkWeekImages(items) {
  const candidates = items.filter((i) => i.creativeLink && (i.captions || []).some((c) => c.has));
  const flags = [];
  let checked = 0, cached = 0, skipped = 0;
  let idx = 0;
  for (const item of candidates) {
    const result = await checkItem(item);
    if (!result) { skipped++; continue; }
    if (result.fromCache) cached++; else checked++;
    for (const n of toNotes(item, result)) {
      flags.push({ _key: 'i' + (idx++), key: item.key, channel: n.channel, note: n.note,
        label: [item.date, item.type, item.title].filter(Boolean).join(' · ') || item.key });
    }
  }
  return { flags, checked, cached, skipped, total: candidates.length };
}
