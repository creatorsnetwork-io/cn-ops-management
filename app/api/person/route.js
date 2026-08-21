import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPS = ['himanshu', 'aashif'];
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);

export async function POST(req) {
  const who = meSlug();
  if (!OPS.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change the team.' }, { status: 403 });
  const b = await req.json();
  const c = sanity(true);

  try {
    if (b.action === 'add') {
      const slug = b.slug ? slugify(b.slug) : slugify(b.name);
      if (!slug || !b.name) return Response.json({ ok: false, error: 'A name is the minimum.' }, { status: 400 });
      const exists = await c.fetch('*[_id==$id][0]{_id}', { id: 'person.' + slug });
      if (exists) return Response.json({ ok: false, error: 'There is already someone with that short name.' }, { status: 400 });
      await c.create({
        _id: 'person.' + slug, _type: 'person', slug,
        name: String(b.name).slice(0, 80), role: String(b.role || '').slice(0, 120),
        email: String(b.email || '').slice(0, 120), active: true,
        reportsTo: b.reportsTo ? { _type: 'reference', _ref: 'person.' + b.reportsTo } : undefined,
      });
      await log(who, 'Added a person', 'person.' + slug, b.name);
      return Response.json({ ok: true, slug });
    }

    if (b.action === 'edit') {
      if (!b.slug) return Response.json({ ok: false, error: 'Nobody selected.' }, { status: 400 });
      if (b.slug === who && b.active === false)
        return Response.json({ ok: false, error: 'You cannot deactivate yourself. Ask the other one of you to do it.' }, { status: 400 });
      const patch = {};
      for (const f of ['name', 'role', 'email']) if (typeof b[f] === 'string') patch[f] = b[f].slice(0, 120);
      if (b.active !== undefined) patch.active = !!b.active;
      if (b.reportsTo !== undefined) patch.reportsTo = b.reportsTo ? { _type: 'reference', _ref: 'person.' + b.reportsTo } : null;
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.patch('person.' + b.slug).set(patch).commit();
      await log(who, 'Edited a person', 'person.' + b.slug, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
