import { sanity } from '../../../lib/sanity';
import { listSheetTabs, readSheetWithLinks } from '../../../lib/google';
import { parseCalendar, summarise, thisWeek, weekStart } from '../../../lib/calendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

// One pass over every social project's current calendar, for one week.
// This is the answer to "what is pending", read straight from the sheets.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const week = q.get('week') ? weekStart(q.get('week')) : thisWeek();

  const projects = await sanity(true).fetch(
    `*[_type=="project" && status=="active" && type=="social"]|order(name asc){
      slug,name,type,"client":client->name,"owner":owner->name,calendarSources}`
  );

  const jobs = [];
  for (const p of projects) {
    const sources = (p.calendarSources || []).filter((c) => c.current && c.sheetId);
    if (!sources.length) { jobs.push(Promise.resolve({ ...p, ok: false, error: 'No calendar link set for this project yet.' })); continue; }
    for (const s of sources) {
      jobs.push((async () => {
        try {
          const meta = await listSheetTabs(s.sheetId);
          const tabs = meta.tabs.map((t) => t.title);
          // Read the tab whose name matches the month of the week, otherwise the first tab.
          const monthName = new Date(week + 'T00:00:00Z').toLocaleString('en', { month: 'long', timeZone: 'UTC' });
          const tab = tabs.find((t) => t.toLowerCase().includes(monthName.toLowerCase())) || tabs[0];
          const rows = await readSheetWithLinks(s.sheetId, tab);
          const parsed = parseCalendar(rows, { year: s.year });
          if (!parsed.ok) return { ...p, source: s.label, ok: false, error: parsed.reason, sheetTitle: meta.title, tab };
          const sum = summarise(parsed.items, week);
          return {
            ...p, source: s.label, sheetId: s.sheetId, sheetTitle: meta.title, tab, tabs, ok: true,
            summary: sum,
            gaps: parsed.items.filter((i) => i.week === week && i.pending)
              .map((i) => ({ date: i.date, channel: i.channel, type: i.type, title: i.title, missing: i.missing, sheetRow: i.sheetRow })),
          };
        } catch (e) {
          const m = (e && e.message) || String(e);
          return { ...p, source: s.label, ok: false,
            error: m.includes('403') ? 'The service account cannot open this sheet. Share it with the service account email.' : m.slice(0, 200) };
        }
      })());
    }
  }

  const rows = await Promise.all(jobs);
  const totals = rows.filter((r) => r.ok).reduce((a, r) => ({
    total: a.total + r.summary.total, ready: a.ready + r.summary.ready, pending: a.pending + r.summary.pending,
  }), { total: 0, ready: 0, pending: 0 });

  return Response.json({ ok: true, week, rows, totals });
}
