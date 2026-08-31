import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STAGES = ['lead', 'meeting', 'talking', 'proposal', 'quoted', 'won', 'lost'];
const OPS = ['himanshu', 'aashif'];
const P = `{_id,name,market,service,stage,valueAed,nextStep,nextStepDate,source,notes,at,
  decidedAt,outcome,"ownerName":owner->name,"owner":owner->slug}`;

export async function GET() {
  const items = await sanity(true).fetch(`*[_type=="prospect"]|order(nextStepDate asc, at desc)[0...200]${P}`);
  return Response.json({ ok: true, items, who: meSlug(), canEdit: OPS.includes(meSlug()) });
}

export async function POST(req) {
  const who = meSlug();
  if (!OPS.includes(who)) return Response.json({ ok: false, error: 'The pipeline is Himanshu and Aashif only.' }, { status: 403 });
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (b.action === 'add') {
      if (!String(b.name || '').trim()) return Response.json({ ok: false, error: 'A name is the minimum.' }, { status: 400 });
      const doc = await c.create({
        _type: 'prospect', at: now, stage: 'lead',
        name: String(b.name).slice(0, 140),
        market: ['Dubai', 'GCC', 'India', 'Europe', 'Other'].includes(b.market) ? b.market : 'Dubai',
        service: String(b.service || '').slice(0, 160),
        valueAed: +b.valueAed || 0,
        nextStep: String(b.nextStep || '').slice(0, 200),
        nextStepDate: b.nextStepDate || null,
        source: String(b.source || '').slice(0, 160),
        notes: String(b.notes || '').slice(0, 3000),
        owner: { _type: 'reference', _ref: 'person.' + (b.owner || who) },
      });
      await log(who, 'Added a prospect', doc._id, b.name);
      return Response.json({ ok: true, id: doc._id });
    }

    if (!b.id) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });

    if (b.action === 'stage') {
      if (!STAGES.includes(b.stage)) return Response.json({ ok: false, error: 'Not a stage.' }, { status: 400 });
      if (b.stage === 'lost' && !String(b.note || '').trim())
        return Response.json({ ok: false, error: 'Write why it was lost. That is the only part of a lost deal worth keeping.' }, { status: 400 });
      const patch = { stage: b.stage };
      if (['won', 'lost'].includes(b.stage)) { patch.decidedAt = now; patch.outcome = String(b.note || '').slice(0, 600); }
      await c.patch(b.id).set(patch).commit();
      await log(who, 'Moved a prospect to ' + b.stage, b.id, b.note || '');
      return Response.json({ ok: true });
    }

    if (b.action === 'edit') {
      const patch = {};
      for (const f of ['name', 'service', 'nextStep', 'source', 'notes']) if (typeof b[f] === 'string') patch[f] = b[f].slice(0, 3000);
      if (b.valueAed !== undefined) patch.valueAed = +b.valueAed || 0;
      if (b.nextStepDate !== undefined) patch.nextStepDate = b.nextStepDate || null;
      if (b.market) patch.market = b.market;
      if (b.owner) patch.owner = { _type: 'reference', _ref: 'person.' + b.owner };
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.patch(b.id).set(patch).commit();
      await log(who, 'Edited a prospect', b.id, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
