import { tabsOf, rowsOf } from '../../../lib/sheetcache';
import { parseCalendar, weeksOf, summarise, thisWeek } from '../../../lib/calendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function plain(e) {
  const m = (e && e.message) || String(e);
  if (m.includes('has not been used') || m.includes('is disabled')) return 'The Google Sheets API is not switched on for this Cloud project.';
  if (m.includes('403') || m.includes('does not have permission')) return 'The service account cannot open this sheet. Share the sheet with it, the same way you would share with a colleague.';
  if (m.includes('404') || m.includes('not found')) return 'That sheet ID does not exist, or the service account cannot see it.';
  if (m.includes('invalid_grant')) return 'The Google key was rejected. Check the JSON key file in the project folder.';
  return m.slice(0, 240);
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const sheetId = q.get('sheetId');
  if (!sheetId) return Response.json({ ok: false, error: 'No sheetId given.' }, { status: 400 });

  try {
    const force = q.get('force') === '1';
    const meta = await tabsOf(sheetId, force);
    const tabs = meta.tabs.map((t) => t.title);
    const tab = q.get('tab') && tabs.includes(q.get('tab')) ? q.get('tab') : tabs[0];
    const year = +(q.get('year') || new Date().getFullYear());

    const read = await rowsOf(sheetId, tab, force);
    const rows = read.rows;
    const parsed = parseCalendar(rows, { year });
    const weeks = weeksOf(parsed.items);
    const week = q.get('week') || (weeks.find((w) => w.week === thisWeek()) ? thisWeek() : (weeks[weeks.length - 1] || {}).week || null);

    return Response.json({
      ok: true, readAt: read.at, fromCache: read.cached,
      sheetTitle: meta.title, tabs, tab, week, weeks,
      headerRow: parsed.headerRow,
      mappedNames: parsed.mappedNames || {},
      linkColumns: parsed.linkColumns || [],
      captionCols: parsed.captionCols || [],
      flagCols: parsed.flagCols || [],
      reason: parsed.reason || null,
      summary: summarise(parsed.items, week),
      overall: summarise(parsed.items, null),
      items: parsed.items,
    });
  } catch (e) {
    return Response.json({ ok: false, error: plain(e) });
  }
}
