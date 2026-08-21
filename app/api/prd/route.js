import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// One working document per project. Editing and commenting are separate rights,
// exactly as the roles table has them: leads comment, they do not rewrite.
export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const rights = can(who, 'editPRD');
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (b.action === 'save') {
      if (rights !== 'yes')
        return Response.json({ ok: false, error: rights === 'comment' ? 'You can comment on this, not rewrite it.' : 'Your role cannot open this document.' }, { status: 403 });
      await c.patch('project.' + b.slug).set({
        prd: String(b.prd || '').slice(0, 60000), prdBy: who, prdAt: now,
      }).commit();
      await log(who, 'Edited the working document', 'project.' + b.slug, '');
      return Response.json({ ok: true, at: now });
    }

    if (b.action === 'comment') {
      if (!['yes', 'comment'].includes(rights))
        return Response.json({ ok: false, error: 'Your role cannot comment on this.' }, { status: 403 });
      if (!String(b.text || '').trim()) return Response.json({ ok: false, error: 'Nothing written.' }, { status: 400 });
      const p = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{prdComments}', { s: b.slug });
      const list = (p.prdComments || []).concat([{
        _key: 'c' + Date.now(), by: who, at: now,
        text: String(b.text).slice(0, 2000),
        quote: String(b.quote || '').slice(0, 300),
        resolved: false,
      }]);
      await c.patch('project.' + b.slug).set({ prdComments: list }).commit();
      await log(who, 'Commented on the working document', 'project.' + b.slug, String(b.text).slice(0, 100));
      return Response.json({ ok: true });
    }

    if (b.action === 'resolve') {
      if (rights !== 'yes') return Response.json({ ok: false, error: 'Only Himanshu or Aashif can close a comment.' }, { status: 403 });
      const p = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{prdComments}', { s: b.slug });
      const list = (p.prdComments || []).map((x) => (x._key === b.key ? { ...x, resolved: true, resolvedBy: who, resolvedAt: now } : x));
      await c.patch('project.' + b.slug).set({ prdComments: list }).commit();
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
