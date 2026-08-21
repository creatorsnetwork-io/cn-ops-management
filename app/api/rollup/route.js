import { rollup, rollupAll } from '../../../lib/rollup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get('slug');
  try {
    if (slug) return Response.json({ ok: true, ...(await rollup(slug)) });
    return Response.json({ ok: true, projects: await rollupAll() });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 200) });
  }
}
