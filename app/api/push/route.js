import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { readProjectWeek, log } from '../../../lib/week';
import { colLetter, readCell, writeCell } from '../../../lib/google';
import { forget } from '../../../lib/sheetcache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

// The only code in this project that writes to a client's sheet.
// Rules, in order: a person must ask for it, the cell must be empty unless they
// explicitly chose to replace, the old value is saved first, and every write is
// logged with who did it and what was there before.

export async function POST(req) {
  const who = meSlug();
  if ((await can(who, 'generate')) === 'no')
    return Response.json({ ok: false, error: 'Your role does not write into calendars.' }, { status: 403 });

  const b = await req.json();
  const replace = b.mode === 'replace';
  if (replace && !['himanshu', 'aashif', 'priyanka', 'shelly'].includes(who))
    return Response.json({ ok: false, error: 'Replacing something already written is limited to Himanshu, Aashif, Priyanka and Shelly.' }, { status: 403 });

  try {
    const w = await readProjectWeek(b.slug, b.week, { force: true });
    if (w.error) return Response.json({ ok: false, error: w.error });
    const item = w.items.find((x) => x.key === b.key);
    if (!item) return Response.json({ ok: false, error: 'That row is no longer in the calendar.' }, { status: 400 });

    const cap = (item.captions || []).find((x) => x.channel === b.channel);
    if (!cap || cap.col == null)
      return Response.json({ ok: false, error: 'Could not work out which column that channel lives in.' }, { status: 400 });

    const a1 = colLetter(cap.col) + item.sheetRow;
    const before = await readCell(w.source.sheetId, w.tab, a1);

    if (before.trim() && !replace)
      return Response.json({
        ok: false, needsReplace: true,
        error: 'That cell already has something in it. Nothing was written. Choose Replace if you mean to overwrite it.',
        existing: before.slice(0, 400),
      });

    const text = String(b.text || '');
    if (!text.trim()) return Response.json({ ok: false, error: 'Nothing to write.' }, { status: 400 });

    // Save what was there before the write, not after.
    const record = await sanity(true).create({
      _type: 'sheetWrite', at: new Date().toISOString(), by: who,
      projectSlug: b.slug, week: w.week, itemKey: b.key, channel: b.channel,
      sheetId: w.source.sheetId, tab: w.tab, cell: a1,
      mode: replace ? 'replace' : 'fill',
      before, after: text,
    });

    await writeCell(w.source.sheetId, w.tab, a1, text);
    forget(w.source.sheetId, w.tab);

    if (b.draftId) await sanity(true).patch(b.draftId).set({ status: 'used', usedAt: new Date().toISOString(), usedBy: who }).commit();

    await log(who, replace ? 'Replaced a cell in the calendar' : 'Filled an empty cell in the calendar',
      b.slug + ':' + w.tab + '!' + a1,
      replace ? 'was: ' + before.slice(0, 120) : 'was empty');

    return Response.json({ ok: true, cell: w.tab + '!' + a1, replaced: replace, recordId: record._id });
  } catch (e) {
    const m = (e.message || String(e));
    if (m.includes('403') || m.includes('permission'))
      return Response.json({ ok: false, error: 'The service account can read that sheet but not write to it. It needs Editor access, not Viewer.' });
    return Response.json({ ok: false, error: m.slice(0, 240) });
  }
}
