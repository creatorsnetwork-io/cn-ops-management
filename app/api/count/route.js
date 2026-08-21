import { sanity } from '../../../lib/sanity';
import { tabsOf, rowsOf } from '../../../lib/sheetcache';
import { meSlug } from '../../../lib/me';
import { parseCalendar } from '../../../lib/calendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const COUNT_ID = (slug) => 'count.' + slug;

// Counts every post in every calendar linked to a project, across every year.
// This is the answer to "did we actually deliver 110 or 120", read from the
// sheets themselves rather than from anyone's memory.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const slug = q.get('slug');
  if (!slug) return Response.json({ ok: false, error: 'No project given.' }, { status: 400 });

  const force = q.get('force') === '1';

  const p = await sanity(true).fetch(
    '*[_type=="project" && slug==$s][0]{name,calendarSources,deliverables,"client":client->name}', { s: slug });
  if (!p) return Response.json({ ok: false, error: 'No such project.' }, { status: 404 });

  // Counting Liberty means opening three tabs and 342 rows. That is fine on a
  // laptop and too slow for a hosted function, which is capped at 60 seconds and
  // not adjustable. So the answer is stored and served instantly, and recounted
  // only when somebody asks for it.
  if (!force) {
    const saved = await sanity(true).fetch('*[_id==$id][0]', { id: COUNT_ID(slug) });
    if (saved && saved.payload) {
      return Response.json({ ...JSON.parse(saved.payload), countedAt: saved.at, countedBy: saved.by, stored: true });
    }
  }

  const sources = (p.calendarSources || []).filter((c) => c.sheetId);
  if (!sources.length) return Response.json({ ok: false, error: 'No calendars linked to this project.' });

  const out = [];
  for (const s of sources) {
    const entry = { label: s.label, year: s.year, current: !!s.current, sheetId: s.sheetId, tabs: [] };
    try {
      const meta = await tabsOf(s.sheetId, force);
      entry.sheetTitle = meta.title;
      for (const t of meta.tabs.slice(0, 14)) {
        try {
          const rows = (await rowsOf(s.sheetId, t.title, force)).rows;
          const r = parseCalendar(rows, { year: s.year });
          if (!r.ok) { entry.tabs.push({ tab: t.title, skipped: 'no header row, treated as a reference tab' }); continue; }
          const items = r.items;
          const byMonth = {};
          for (const i of items) {
            const k = i.date ? i.date.slice(0, 7) : 'undated';
            byMonth[k] = (byMonth[k] || 0) + 1;
          }
          entry.tabs.push({
            tab: t.title,
            posts: items.length,
            withCaption: items.filter((i) => i.hasCaption).length,
            withCreative: items.filter((i) => i.hasCreative).length,
            complete: items.filter((i) => !i.pending).length,
            withLink: items.filter((i) => i.creativeLink).length,
            byMonth,
          });
        } catch (e) { entry.tabs.push({ tab: t.title, error: (e.message || String(e)).slice(0, 140) }); }
      }
    } catch (e) { entry.error = (e.message || String(e)).slice(0, 180); }
    out.push(entry);
  }

  const counted = out.flatMap((e) => e.tabs.filter((t) => t.posts != null));
  const totals = counted.reduce((a, t) => ({
    posts: a.posts + t.posts, complete: a.complete + t.complete,
    withCaption: a.withCaption + t.withCaption, withCreative: a.withCreative + t.withCreative,
  }), { posts: 0, complete: 0, withCaption: 0, withCreative: 0 });

  const months = {};
  for (const t of counted) for (const k of Object.keys(t.byMonth || {})) months[k] = (months[k] || 0) + t.byMonth[k];

  const payload = { ok: true, project: p.name, client: p.client, deliverables: p.deliverables || [], sources: out, totals, months };
  const now = new Date().toISOString();
  try {
    await sanity(true).createOrReplace({
      _id: COUNT_ID(slug), _type: 'countCache', projectSlug: slug,
      at: now, by: meSlug() || 'unknown', payload: JSON.stringify(payload),
    });
  } catch (e) {}
  return Response.json({ ...payload, countedAt: now, countedBy: meSlug(), stored: false });
}
