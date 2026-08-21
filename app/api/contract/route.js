import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { textFromFile } from '../../../lib/readdoc';
import { chat, HOUSE } from '../../../lib/ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

// Upload a contract, then read the deliverables out of it rather than typing them.
// Nothing is applied automatically: the lines come back as a proposal.
export async function POST(req) {
  const who = meSlug();
  if (can(who, 'uploadContract') !== 'yes')
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can upload a contract.' }, { status: 403 });

  const ct = req.headers.get('content-type') || '';

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const slug = String(form.get('slug') || '');
      const file = form.get('file');
      if (!slug || !file || typeof file === 'string')
        return Response.json({ ok: false, error: 'Pick a project and a file.' }, { status: 400 });

      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024)
        return Response.json({ ok: false, error: 'That file is over 15MB. Upload the signed pages rather than the whole pack.' }, { status: 400 });

      const { text, how } = await textFromFile(buf, file.name, file.type);
      if (!text.trim())
        return Response.json({ ok: false, error: 'No text could be read out of that file. If it is a scan, it needs to be a text PDF.' });

      const asset = await sanity(true).assets.upload('file', buf, { filename: file.name });
      const now = new Date().toISOString();

      await sanity(true).patch('project.' + slug).set({
        contract: {
          filename: file.name, at: now, by: who, read: how,
          asset: { _type: 'reference', _ref: asset._id },
          characters: text.length,
        },
        contractText: text.slice(0, 200000),
      }).commit();

      await log(who, 'Uploaded a contract', 'project.' + slug, file.name + ', read as ' + how + ', ' + text.length + ' characters');
      return Response.json({ ok: true, filename: file.name, characters: text.length, url: asset.url });
    }

    const b = await req.json();

    // Read the uploaded contract and propose deliverable lines.
    if (b.action === 'remove') {
      if (!b.slug) return Response.json({ ok: false, error: 'Which project.' }, { status: 400 });
      await sanity(true).patch('project.' + b.slug).unset(['contract', 'contractText']).commit();
      await log(who, 'Removed a contract', 'project.' + b.slug, 'the deliverable baseline was left alone');
      return Response.json({ ok: true });
    }

    if (b.action === 'extract') {
      const p = await sanity(true).fetch(
        '*[_type=="project" && slug==$s][0]{name,contractText,"client":client->name}', { s: b.slug });
      if (!p || !p.contractText)
        return Response.json({ ok: false, error: 'No contract has been uploaded against this project yet.' }, { status: 400 });

      const out = await chat({
        json: true, maxTokens: 1800,
        system: `You read agency contracts and pull out only what was actually promised. ${HOUSE}

Return JSON only, shaped {"deliverables":[{"name":"...","target":<number>,"period":"week"|"month"|"year"|"total","acceptance":"..."}],"unclear":["..."]}.
Rules: only include something if the contract states it. Do not infer, round, or helpfully complete a number. If a quantity is stated as a range or a minimum, use the lower number and say so in acceptance. Put anything you could not pin down in "unclear" rather than guessing.`,
        user: `Client: ${p.client}. Project: ${p.name}.

The contract text:

${String(p.contractText).slice(0, 60000)}`,
      });

      let parsed = { deliverables: [], unclear: [] };
      try { parsed = JSON.parse(out.text); } catch (e) {
        return Response.json({ ok: false, error: 'The read came back in a shape I could not use.' });
      }
      const clean = (parsed.deliverables || []).map((d, i) => ({
        _key: 'x' + i,
        name: String(d.name || '').slice(0, 120),
        target: +d.target || 0,
        period: ['week', 'month', 'year', 'total'].includes(d.period) ? d.period : 'total',
        acceptance: String(d.acceptance || '').slice(0, 500),
      })).filter((d) => d.name);

      await log(who, 'Read deliverables out of a contract', 'project.' + b.slug, clean.length + ' lines via ' + out.model);
      return Response.json({ ok: true, deliverables: clean, unclear: parsed.unclear || [], model: out.model });
    }

    // Accept the proposal, replacing the baseline.
    if (b.action === 'apply') {
      if (can(who, 'editDeliverables') !== 'yes')
        return Response.json({ ok: false, error: 'Only Himanshu or Aashif can set the baseline.' }, { status: 403 });
      const rows = (b.deliverables || []).map((d, i) => ({
        _key: 'dl' + Date.now() + i,
        name: String(d.name || '').slice(0, 120),
        target: +d.target || 0,
        period: ['week', 'month', 'year', 'total'].includes(d.period) ? d.period : 'year',
        acceptance: String(d.acceptance || '').slice(0, 500),
      })).filter((d) => d.name);
      await sanity(true).patch('project.' + b.slug).set({ deliverables: rows }).commit();
      await log(who, 'Set the deliverable baseline from the contract', 'project.' + b.slug, rows.length + ' lines');
      return Response.json({ ok: true, count: rows.length });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 260) });
  }
}
