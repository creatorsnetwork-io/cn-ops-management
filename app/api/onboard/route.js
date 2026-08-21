import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { log } from '../../../lib/week';
import { BY_HAND, STEPS } from '../../../lib/onboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPS = ['himanshu', 'aashif'];

// Only the steps that cannot be proven from data can be ticked. Trying to tick a
// derived one is refused, with the reason, rather than silently ignored.
export async function POST(req) {
  const who = meSlug();
  if (!OPS.includes(who))
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can sign off a setup step.' }, { status: 403 });

  const b = await req.json();
  const i = Number(b.step);
  if (!b.slug || !Number.isInteger(i) || i < 0 || i >= STEPS.length)
    return Response.json({ ok: false, error: 'Which client and which step.' }, { status: 400 });
  if (!BY_HAND.includes(i))
    return Response.json({ ok: false, error: 'That step is worked out from the portal itself. Do the thing and it ticks itself.' }, { status: 400 });

  const c = await sanity(true).fetch('*[_id==$id][0]{onbManual}', { id: 'client.' + b.slug });
  if (!c) return Response.json({ ok: false, error: 'No such client.' }, { status: 404 });

  const manual = { ...(c.onbManual || {}) };
  if (b.on === false) delete manual[String(i)]; else manual[String(i)] = true;

  await sanity(true).patch('client.' + b.slug).set({ onbManual: manual }).commit();
  await log(who, (b.on === false ? 'Reopened a setup step' : 'Signed off a setup step'), 'client.' + b.slug, STEPS[i]);
  return Response.json({ ok: true, manual });
}
