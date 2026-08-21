import { sanity } from './sanity';
import { tabsOf, rowsOf, cachedDoc, forgetDoc } from './sheetcache';
import { parseCalendar, weekStart, thisWeek } from './calendar';

export const reviewId = (slug, week) => 'week.' + slug + '.' + week;
export const itemKey = (tab, sheetRow) => tab + ':' + sheetRow;

// A short signature of the content, so we can tell if a row changed
// after someone signed a gate on it.
export function fingerprint(i) {
  const caps = (i.captions || []).map((c) => (c.text || '').trim().slice(0, 40)).join('|');
  return [i.date || '', i.type || '', (i.title || '').slice(0, 40), caps, i.creativeLink || i.creativeText || ''].join('~');
}

export async function getProject(slug) {
  return cachedDoc('project:' + slug, 60 * 1000, () => sanity(true).fetch(
    `*[_type=="project" && slug==$s][0]{slug,name,type,cadence,calendarSources,deliverables,extraBanned,
      "client":client->{name,code,driveFolderId},"owner":owner->{name,slug}}`, { s: slug }));
}

// Anything that edits a project must drop it, or the next read is stale.
export function forgetProject(slug) { forgetDoc('project:' + slug); }

// Reads the calendar for one project and one week. Picks the tab itself:
// the month name first, then whichever tab actually holds that week.
export async function readProjectWeek(slug, weekIn, opts) {
  const week = weekIn ? weekStart(weekIn) : thisWeek();
  const project = await getProject(slug);
  if (!project) return { error: 'No project called ' + slug };

  const source = (project.calendarSources || []).find((c) => c.current && c.sheetId)
    || (project.calendarSources || []).find((c) => c.sheetId);
  if (!source) return { project, week, error: 'No calendar link on this project yet.' };

  const meta = await tabsOf(source.sheetId, opts && opts.force);
  const tabs = meta.tabs.map((t) => t.title);
  const monthName = new Date(week + 'T00:00:00Z').toLocaleString('en', { month: 'long', timeZone: 'UTC' });
  const order = tabs.slice().sort((a, b) => {
    const s = (t) => (t.toLowerCase().includes(monthName.toLowerCase()) ? 0 : 1);
    return s(a) - s(b);
  });

  let best = null;
  for (const t of order.slice(0, 6)) {
    const read = await rowsOf(source.sheetId, t, opts && opts.force);
    const rows = read.rows;
    const parsed = parseCalendar(rows, { year: source.year });
    if (!parsed.ok) continue;
    const inWeek = parsed.items.filter((i) => i.week === week).map((i) => ({ ...i, key: itemKey(t, i.sheetRow) }));
    const cand = { tab: t, tabs, parsed, items: inWeek, sheetTitle: meta.title, readAt: read.at, fromCache: read.cached };
    if (!best || inWeek.length > best.items.length) best = cand;
    if (inWeek.length) break;
  }

  if (!best) return { project, week, source, error: 'Could not make sense of any tab in this sheet.' };
  return { project, week, source, sheetTitle: best.sheetTitle, tab: best.tab, tabs: best.tabs,
           items: best.items, readAt: best.readAt, fromCache: best.fromCache };
}

export async function loadReview(slug, week) {
  return sanity(true).fetch('*[_id==$id][0]', { id: reviewId(slug, week) });
}

export async function ensureReview(slug, week) {
  const id = reviewId(slug, week);
  const existing = await loadReview(slug, week);
  if (existing) return existing;
  await sanity(true).createIfNotExists({
    _id: id, _type: 'weekReview',
    project: { _type: 'reference', _ref: 'project.' + slug },
    projectSlug: slug, week,
    items: [], flags: [], craftGate: null, shipGate: null,
  });
  return loadReview(slug, week);
}

export async function log(who, what, target, detail) {
  return sanity(true).create({
    _type: 'activity', at: new Date().toISOString(), who, what, target, detail: detail || '',
  });
}
