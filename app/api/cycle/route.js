import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { thisMonth, cycleId, loadCycle, ensureCycle } from '../../../lib/cycles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);

// A month with a report at the end of it. Used for SEO, where nothing lands
// weekly but something has to land monthly.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const slug = q.get('slug');
  const month = q.get('month') || thisMonth();
  if (!slug) return Response.json({ ok: false, error: 'No project given.' }, { status: 400 });

  const who = meSlug();
  const cycle = await loadCycle(slug, month);
  const work = await sanity(true).fetch(
    `*[_type=="work" && project->slug==$s]|order(due asc){
      _id,title,kind,state,due,"assigneeName":assignee->name,approvedBy,approvedAt}`, { s: slug });

  const inMonth = work.filter((w) => (w.due || '').startsWith(month) || (w.approvedAt || '').startsWith(month));

  return Response.json({
    ok: true, month, slug,
    cycle: cycle || null,
    work: inMonth,
    done: inMonth.filter((w) => ['approved', 'done'].includes(w.state)).length,
    perms: { ship: can(who, 'shipGate'), canShip: softYes(can(who, 'shipGate')), who },
  });
}

export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const month = b.month || thisMonth();
  const id = cycleId(b.slug, month);
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    await ensureCycle(b.slug, month);

    if (b.action === 'save') {
      const patch = {};
      if (typeof b.reportLink === 'string') {
        const link = b.reportLink.slice(0, 500);
        const cur = await loadCycle(b.slug, month);
        if (link !== (cur?.reportLink || '')) {
          patch.reportLink = link;
          patch.reportLinkAt = link ? now : null;
          patch.reportLinkBy = link ? who : null;
        } else {
          patch.reportLink = link;
        }
      }
      if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 4000);
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.patch(id).set(patch).commit();
      await log(who, 'Updated a monthly cycle', id, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    // The month starts with a brainstorm and the client approving the ideas.
    // Both were in the prototype's rhythm and neither was tracked anywhere.
    if (b.action === 'mark') {
      const f = b.step;
      if (!['brainstorm', 'ideas', 'ideasWith'].includes(f))
        return Response.json({ ok: false, error: 'Not a step.' }, { status: 400 });
      const patch = {};
      if (f === 'brainstorm') patch.brainstormAt = b.clear ? null : now;
      if (f === 'ideas') { patch.ideasApprovedAt = b.clear ? null : now; patch.ideasSentAt = patch.ideasSentAt || null; }
      if (f === 'ideasWith') { patch.ideasSentAt = b.clear ? null : now; patch.ideasApprovedAt = null; }
      await c.patch(id).set(patch).commit();
      await log(who, 'Marked the monthly ' + f + ' step', id, b.clear ? 'cleared' : '');
      return Response.json({ ok: true });
    }

    if (b.action === 'ship') {
      if (!softYes(can(who, 'shipGate')))
        return Response.json({ ok: false, error: 'Your role does not sign a month off.' }, { status: 403 });
      const cur = await loadCycle(b.slug, month);
      if (!cur.reportLink)
        return Response.json({ ok: false, error: 'There is no report linked yet. A month without a report is not finished.' });
      await c.patch(id).set({ shipGate: { by: who, at: now } }).commit();
      await log(who, 'Signed off a month', id, '');
      return Response.json({ ok: true });
    }

    if (b.action === 'ack') {
      if (!String(b.by || '').trim())
        return Response.json({ ok: false, error: 'Name who at the client acknowledged it.' }, { status: 400 });
      await c.patch(id).set({ clientAck: { by: String(b.by).slice(0, 120), at: now, recordedBy: who, note: String(b.note || '').slice(0, 600) } }).commit();
      await log(who, 'Recorded a client acknowledgement for a month', id, b.by);
      return Response.json({ ok: true });
    }

    if (b.action === 'reopen') {
      if (!softYes(can(who, 'shipGate'))) return Response.json({ ok: false, error: 'Your role cannot reopen a month.' }, { status: 403 });
      await c.patch(id).set({ shipGate: null }).commit();
      await log(who, 'Reopened a month', id, '');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
