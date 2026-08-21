import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// A star is per person, not per company. Himanshu starring Liberty should not
// put a star on Shelly's screen.
export async function POST(req) {
  const who = meSlug();
  if (!who) return Response.json({ ok: false, error: 'Not signed in.' }, { status: 403 });
  const b = await req.json();
  if (!['client', 'project'].includes(b.kind) || !b.slug)
    return Response.json({ ok: false, error: 'Nothing to star.' }, { status: 400 });

  const id = 'person.' + who;
  const field = b.kind === 'client' ? 'favClients' : 'favProjects';
  const p = await sanity(true).fetch('*[_id==$id][0]{favClients,favProjects}', { id });
  const list = (p && p[field]) || [];
  const next = list.includes(b.slug) ? list.filter((x) => x !== b.slug) : list.concat([b.slug]);

  await sanity(true).patch(id).set({ [field]: next }).commit();
  return Response.json({ ok: true, on: next.includes(b.slug), list: next });
}
