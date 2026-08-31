import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { MILESTONE_STATES } from '../../../lib/cycles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPS = ['himanshu', 'aashif'];
const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);

// A named thing that lands on a date. Used for websites and campaigns, where
// nothing repeats but plenty is promised.
export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    const p = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{_id,milestones}', { s: b.slug });
    if (!p) return Response.json({ ok: false, error: 'No such project.' }, { status: 404 });
    const list = p.milestones || [];

    if (b.action === 'add') {
      if (!OPS.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can add a milestone.' }, { status: 403 });
      if (!String(b.name || '').trim()) return Response.json({ ok: false, error: 'A name is the minimum.' }, { status: 400 });
      const next = list.concat([{
        _key: 'm' + Date.now(), name: String(b.name).slice(0, 160),
        due: b.due || null, state: 'planned',
        acceptance: String(b.acceptance || '').slice(0, 500),
        history: [{ _key: 'h' + Date.now(), at: now, who, to: 'planned', note: 'Added' }],
      }]);
      await c.patch(p._id).set({ milestones: next }).commit();
      await log(who, 'Added a milestone', p._id, b.name);
      return Response.json({ ok: true });
    }

    if (b.action === 'move') {
      if (!MILESTONE_STATES.includes(b.state)) return Response.json({ ok: false, error: 'Not a state.' }, { status: 400 });
      const m = list.find((x) => x._key === b.key);
      if (!m) return Response.json({ ok: false, error: 'That milestone is gone.' }, { status: 404 });

      if (b.state === 'delivered' && !softYes(await can(who, 'shipGate')))
        return Response.json({ ok: false, error: 'Only whoever holds the ship gate can mark something delivered.' }, { status: 403 });
      if (b.state === 'approved' && !String(b.clientName || '').trim())
        return Response.json({ ok: false, error: 'Name the person at the client who approved it.' }, { status: 400 });

      const next = list.map((x) => (x._key === b.key ? {
        ...x, state: b.state,
        approvedBy: b.state === 'approved' ? String(b.clientName).slice(0, 120) : x.approvedBy,
        approvedAt: b.state === 'approved' ? now : x.approvedAt,
        history: (x.history || []).concat([{ _key: 'h' + Date.now(), at: now, who, to: b.state, note: String(b.note || b.clientName || '').slice(0, 400) }]),
      } : x));
      await c.patch(p._id).set({ milestones: next }).commit();
      await log(who, 'Moved a milestone to ' + b.state, p._id, m.name);
      return Response.json({ ok: true });
    }

    if (b.action === 'remove') {
      if (!OPS.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can remove a milestone.' }, { status: 403 });
      await c.patch(p._id).set({ milestones: list.filter((x) => x._key !== b.key) }).commit();
      await log(who, 'Removed a milestone', p._id, b.key);
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
