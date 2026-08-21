import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPS = ['himanshu', 'aashif'];
const LEADS = ['himanshu', 'aashif', 'priyanka', 'shelly'];
const P = `{_id,name,kind,skills,rate,contact,notes,active,at,jobs,
  "avg": math::avg(jobs[].score), "count": count(jobs)}`;

export async function GET() {
  const items = await sanity(true).fetch(`*[_type=="vendor"]|order(active desc, name asc)[0...200]${P}`);
  const who = meSlug();
  return Response.json({ ok: true, items, who, canEdit: OPS.includes(who), canRate: LEADS.includes(who) });
}

// The real problem with vendors is not that they go quiet, it is rework.
// So the only thing recorded per job is how much rework it caused.
export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (b.action === 'add') {
      if (!OPS.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can add a vendor.' }, { status: 403 });
      if (!String(b.name || '').trim()) return Response.json({ ok: false, error: 'A name is the minimum.' }, { status: 400 });
      const doc = await c.create({
        _type: 'vendor', at: now, active: true,
        name: String(b.name).slice(0, 140),
        kind: ['vendor', 'freelancer'].includes(b.kind) ? b.kind : 'freelancer',
        skills: String(b.skills || '').slice(0, 300),
        rate: String(b.rate || '').slice(0, 120),
        contact: String(b.contact || '').slice(0, 200),
        notes: String(b.notes || '').slice(0, 2000),
        jobs: [],
      });
      await log(who, 'Added a vendor', doc._id, b.name);
      return Response.json({ ok: true, id: doc._id });
    }

    if (!b.id) return Response.json({ ok: false, error: 'Nobody selected.' }, { status: 400 });

    if (b.action === 'edit') {
      if (!OPS.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can edit a vendor.' }, { status: 403 });
      const patch = {};
      for (const f of ['name', 'skills', 'rate', 'contact', 'notes']) if (typeof b[f] === 'string') patch[f] = b[f].slice(0, 2000);
      if (b.active !== undefined) patch.active = !!b.active;
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.patch(b.id).set(patch).commit();
      await log(who, 'Edited a vendor', b.id, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    if (b.action === 'rate') {
      if (!LEADS.includes(who)) return Response.json({ ok: false, error: 'Only a lead records how a job went.' }, { status: 403 });
      const score = Number(b.score);
      if (![1, 2, 3].includes(score))
        return Response.json({ ok: false, error: 'Pick one: landed first time, needed a round, or had to be redone.' }, { status: 400 });
      if (score > 1 && !String(b.note || '').trim())
        return Response.json({ ok: false, error: 'Say what went wrong. A bad score with no reason teaches nobody anything.' }, { status: 400 });

      const v = await sanity(true).fetch('*[_id==$id][0]{jobs}', { id: b.id });
      const jobs = (v.jobs || []).concat([{
        _key: 'j' + Date.now(), at: now, by: who, score,
        what: String(b.what || '').slice(0, 200),
        note: String(b.note || '').slice(0, 800),
        workId: b.workId || '',
      }]);
      await c.patch(b.id).set({ jobs }).commit();
      await log(who, 'Recorded how a vendor job went', b.id, 'score ' + score + '. ' + (b.note || ''));
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
