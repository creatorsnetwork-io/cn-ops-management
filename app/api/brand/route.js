import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { textFromFile } from '../../../lib/readdoc';
import { textFromLink, proposeBrand, cleanBrand } from '../../../lib/brand';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

// The brand brain lives on the CLIENT, not the project. A client's website
// project and their social retainer should read the same voice and the same
// never-say list, not two independent copies of it.
//
// Brand is Priyanka's, day to day (see approveBrand in lib/perm.js: she is 'yes',
// Gowtham is SEO-specific, Himanshu and Aashif are exception and oversight only).
// Unlike Settings, which is Himanshu and Aashif exclusively, this checks that
// dedicated permission rather than the admin one, and logs the shade an edit
// came in under so an exception or an oversight save is visible on the record.
async function shadeOf(who) {
  const v = await can(who, 'approveBrand');
  return ['himanshu', 'aashif', 'priyanka', 'gowtham'].includes(who) && v !== 'no' ? v : '';
}

async function extractAndRespond({ text, how, filename, slug, who, shade, c }) {
  if (!text || !text.trim())
    return Response.json({ ok: false, error: 'No text could be read out of that. If it is a scan, it needs to be a text PDF.' });

  const client = await c.fetch('*[_type=="client" && slug==$s][0]{name}', { s: slug });
  if (!client) return Response.json({ ok: false, error: 'That client was not found.' }, { status: 404 });

  const out = await proposeBrand({ text, clientName: client.name });
  await log(who, 'Read the brand brain out of a document' + (shade !== 'yes' ? ' (' + shade + ')' : ''),
    'client.' + slug, filename + ', via ' + out.model);
  return Response.json({ ok: true, proposal: out.proposal, source: { filename, how, characters: text.length }, model: out.model });
}

export async function POST(req) {
  const who = meSlug();
  const shade = await shadeOf(who);
  if (!shade) return Response.json({ ok: false, error: 'Your role does not edit the brand brain.' }, { status: 403 });

  const ct = req.headers.get('content-type') || '';
  const c = sanity(true);

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const slug = String(form.get('slug') || '');
      const file = form.get('file');
      if (!slug || !file || typeof file === 'string')
        return Response.json({ ok: false, error: 'Pick a client and a file.' }, { status: 400 });

      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024)
        return Response.json({ ok: false, error: 'That file is over 15MB.' }, { status: 400 });

      const { text, how } = await textFromFile(buf, file.name, file.type);
      return await extractAndRespond({ text, how, filename: file.name, slug, who, shade, c });
    }

    const b = await req.json();

    // Read a document, either just uploaded or a pasted Drive/Docs link, and
    // propose brand fields from it. Nothing is saved by this step.
    if (b.action === 'extract') {
      if (!b.slug) return Response.json({ ok: false, error: 'Which client.' }, { status: 400 });
      if (!String(b.link || '').trim())
        return Response.json({ ok: false, error: 'Paste a Drive or Google Docs link, or upload a file instead.' }, { status: 400 });
      let resolved;
      try { resolved = await textFromLink(b.link); }
      catch (e) { return Response.json({ ok: false, error: e.message }); }
      return await extractAndRespond({ ...resolved, slug: b.slug, who, shade, c });
    }

    // The fields a person actually decided to keep, after picking or merging
    // against whatever was proposed. This is the only step that writes.
    if (b.action === 'save') {
      if (!b.slug) return Response.json({ ok: false, error: 'Which client.' }, { status: 400 });
      const brand = cleanBrand(b.brand);
      const now = new Date().toISOString();
      await c.patch('client.' + b.slug).set({ brand: { ...brand, updatedAt: now, updatedBy: who } }).commit();
      await log(who, 'Updated the brand brain' + (shade !== 'yes' ? ' (' + shade + ')' : ''), 'client.' + b.slug, '');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 260) });
  }
}
