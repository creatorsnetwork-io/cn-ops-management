import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPS = ['himanshu', 'aashif'];

export async function POST(req) {
  const who = meSlug();
  const ct = req.headers.get('content-type') || '';

  try {
    // Logo upload
    if (ct.includes('multipart/form-data')) {
      if (!OPS.includes(who) && (await can(who, 'createClient')) === 'no')
        return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change a client record.' }, { status: 403 });
      const form = await req.formData();
      const slug = String(form.get('slug') || '');
      const file = form.get('file');
      if (!slug || !file || typeof file === 'string') return Response.json({ ok: false, error: 'Pick a client and a file.' }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 3 * 1024 * 1024) return Response.json({ ok: false, error: 'Keep the logo under 3MB.' }, { status: 400 });
      const asset = await sanity(true).assets.upload('image', buf, { filename: file.name });
      await sanity(true).patch('client.' + slug).set({ logo: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }, logoUrl: asset.url }).commit();
      await log(who, 'Uploaded a client logo', 'client.' + slug, file.name);
      return Response.json({ ok: true, url: asset.url });
    }

    const b = await req.json();
    if (!OPS.includes(who) && (await can(who, 'createClient')) === 'no')
      return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change a client record.' }, { status: 403 });

    if (b.action === 'add') {
      const name = String(b.name || '').trim();
      if (!name) return Response.json({ ok: false, error: 'A name is the minimum.' }, { status: 400 });
      const slug = String(b.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
      if (!slug) return Response.json({ ok: false, error: 'That name has no letters or numbers in it.' }, { status: 400 });
      const exists = await sanity(true).fetch('*[_id==$id][0]{_id}', { id: 'client.' + slug });
      if (exists) return Response.json({ ok: false, error: 'There is already a client with that short name.' }, { status: 400 });

      await sanity(true).create({
        _id: 'client.' + slug, _type: 'client', slug,
        name: name.slice(0, 140),
        code: String(b.code || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || slug.toUpperCase().slice(0, 6),
        note: String(b.note || '').slice(0, 300),
        driveFolderId: String(b.driveFolderId || '').trim().replace(/^https?:\/\/drive\.google\.com\/drive\/folders\//, '').split(/[?\/]/)[0],
        contacts: [], active: true,
      });
      await log(who, 'Added a client', 'client.' + slug, name);
      return Response.json({ ok: true, slug });
    }

    // Everything past this point needs an existing client.
    if (!b.slug) return Response.json({ ok: false, error: 'No client given.' }, { status: 400 });

    if (b.action === 'contacts') {
      const rows = (b.contacts || []).slice(0, 30).map((x, i) => ({
        _key: x._key || 'ct' + Date.now() + i,
        name: String(x.name || '').slice(0, 100),
        role: String(x.role || '').slice(0, 100),
        email: String(x.email || '').slice(0, 140),
        phone: String(x.phone || '').slice(0, 40),
        canApprove: !!x.canApprove,
      })).filter((x) => x.name);
      await sanity(true).patch('client.' + b.slug).set({ contacts: rows }).commit();
      await log(who, 'Updated client contacts', 'client.' + b.slug, rows.length + ' people');
      return Response.json({ ok: true });
    }

    if (b.action === 'obligations') {
      const rows = (b.obligations || []).slice(0, 30).map((x, i) => ({
        _key: x._key || 'ob' + Date.now() + i,
        name: String(x.name || '').slice(0, 140),
        due: x.due || null,
        owner: String(x.owner || '').slice(0, 40),
        every: ['month', 'quarter', 'year', 'once'].includes(x.every) ? x.every : 'month',
        doneAt: x.doneAt || null, doneBy: x.doneBy || null,
      })).filter((x) => x.name);
      await sanity(true).patch('client.' + b.slug).set({ obligations: rows }).commit();
      await log(who, 'Updated client obligations', 'client.' + b.slug, rows.length + ' items');
      return Response.json({ ok: true });
    }

    // Marking one done rolls the date forward, because these recur. A recurring
    // job that has to be re-typed every month is a recurring job that gets missed.
    if (b.action === 'obligationDone') {
      const c = await sanity(true).fetch('*[_id==$id][0]{obligations}', { id: 'client.' + b.slug });
      const now = new Date().toISOString();
      const add = { month: 1, quarter: 3, year: 12, once: 0 };
      const rows = (c.obligations || []).map((x) => {
        if (x._key !== b.key) return x;
        let due = x.due;
        const step = add[x.every] || 0;
        if (due && step) {
          const d = new Date(due + 'T00:00:00Z');
          d.setUTCMonth(d.getUTCMonth() + step);
          due = d.toISOString().slice(0, 10);
        }
        return { ...x, due, doneAt: now, doneBy: who };
      });
      await sanity(true).patch('client.' + b.slug).set({ obligations: rows }).commit();
      await log(who, 'Marked a client obligation done', 'client.' + b.slug, b.key);
      return Response.json({ ok: true });
    }

    if (b.action === 'edit') {
      const patch = {};
      for (const f of ['name', 'code', 'note', 'driveFolderId', 'channel', 'turnaround', 'renewal']) if (typeof b[f] === 'string') patch[f] = b[f].slice(0, 300);
      if (b.active !== undefined) patch.active = !!b.active;
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await sanity(true).patch('client.' + b.slug).set(patch).commit();
      await log(who, 'Edited a client', 'client.' + b.slug, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}

// Same rule as projects: only if nothing is attached.
export async function DELETE(req) {
  const who = meSlug();
  if (!['himanshu', 'aashif'].includes(who))
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can remove a client.' }, { status: 403 });
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return Response.json({ ok: false, error: 'Which client.' }, { status: 400 });

  const counts = await sanity(true).fetch(
    `{"projects": count(*[_type=="project" && client->slug==$s]),
      "requests": count(*[_type=="request" && client->slug==$s])}`, { s: slug });
  const attached = Object.keys(counts).filter((k) => counts[k] > 0);
  if (attached.length)
    return Response.json({
      ok: false,
      error: 'This client has ' + attached.map((k) => counts[k] + ' ' + k).join(' and ')
        + ' against it. Deactivate it instead of removing it.',
    }, { status: 400 });

  await sanity(true).delete('client.' + slug);
  await log(who, 'Removed an empty client', 'client.' + slug, '');
  return Response.json({ ok: true });
}
