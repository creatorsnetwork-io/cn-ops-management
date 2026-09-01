import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import { can } from '../../../../lib/perm';
import { forgetProject, log } from '../../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Same shortfall math as the project page, kept in one place so closing checks
// the same numbers a person sees before they decide to close.
async function deliverableGap(slug) {
  const p = await sanity(true).fetch(
    `*[_type=="project" && slug==$s][0]{
      deliverables,
      "reviews": *[_type=="weekReview" && projectSlug==$s]{clientDecisions},
      "work": *[_type=="work" && project->slug==$s]{state}
    }`, { s: slug }
  );
  const target = (p?.deliverables || []).reduce((a, d) => a + (+d.target || 0), 0);
  const socialApproved = (p?.reviews || []).reduce((n, r) => n + (r.clientDecisions || []).filter((d) => d.decision === 'approved').length, 0);
  const workApproved = (p?.work || []).filter((w) => ['approved', 'done'].includes(w.state)).length;
  return { target, approved: socialApproved + workApproved };
}

export async function PATCH(req, { params }) {
  const who = meSlug();
  const body = await req.json();

  // Generating the dispute pack is a step of closing, not the close itself,
  // so it gets its own small write: open the pack, stamp that it happened.
  if (body.markPackGenerated) {
    if ((await can(who, 'closeProject')) !== 'yes')
      return Response.json({ ok: false, error: 'Only Himanshu or Aashif can do this.' }, { status: 403 });
    const now = new Date().toISOString();
    await sanity(true).patch('project.' + params.slug).set({ packGeneratedAt: now }).commit();
    forgetProject(params.slug);
    return Response.json({ ok: true, packGeneratedAt: now });
  }

  // Closing is its own thing, not a field edit: it needs a reason, a
  // permission of its own, and never reopens what it just closed. It now also
  // means what the archive page has always said it means: deliverables
  // reconciled (or the shortfall explained), final files linked, and the
  // dispute pack generated, on top of the reason.
  if (body.close) {
    if ((await can(who, 'closeProject')) !== 'yes')
      return Response.json({ ok: false, error: 'Only Himanshu or Aashif can close a project.' }, { status: 403 });
    const reason = String(body.close.reason || '').trim();
    if (!reason)
      return Response.json({ ok: false, error: 'Write why this is closing now. That is the part of a closure worth keeping.' }, { status: 400 });

    const finalFilesUrl = String(body.close.finalFilesUrl || '').trim();
    if (!/^https?:\/\//i.test(finalFilesUrl))
      return Response.json({ ok: false, error: 'Add a link to the final files before closing.' }, { status: 400 });

    const { target, approved } = await deliverableGap(params.slug);
    let shortfallNote = '';
    if (target > 0 && approved < target) {
      shortfallNote = String(body.close.shortfallNote || '').trim();
      if (!shortfallNote)
        return Response.json({ ok: false, error: 'Deliverables are short (' + approved + ' of ' + target + '). Explain the shortfall before closing.' }, { status: 400 });
    }

    const current = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{packGeneratedAt}', { s: params.slug });
    if (!current?.packGeneratedAt)
      return Response.json({ ok: false, error: 'Generate the dispute pack before closing.' }, { status: 400 });

    const now = new Date().toISOString();
    const patch = {
      status: 'closed', closedAt: now, closedBy: who, closedReason: reason.slice(0, 600),
      finalFilesUrl: finalFilesUrl.slice(0, 500),
    };
    if (shortfallNote) patch.deliverableShortfallNote = shortfallNote.slice(0, 600);
    const doc = await sanity(true).patch('project.' + params.slug).set(patch).commit();
    forgetProject(params.slug);
    await log(who, 'Closed the project', 'project.' + params.slug, reason.slice(0, 600));
    return Response.json({ ok: true, project: doc });
  }

  if ('calendarSources' in body && (await can(who, 'editCalendarSources')) !== 'yes') {
    return Response.json({ ok: false, error: 'Only Himanshu and Aashif can change calendar links.' }, { status: 403 });
  }

  const patch = {};
  if (Array.isArray(body.calendarSources)) {
    patch.calendarSources = body.calendarSources.map((c, i) => ({
      _key: c._key || 'cal' + Date.now() + i,
      label: String(c.label || '').slice(0, 120),
      sheetId: String(c.sheetId || '').trim().replace(/^https?:\/\/docs\.google\.com\/spreadsheets\/d\//, '').split('/')[0],
      year: +c.year || new Date().getFullYear(),
      current: !!c.current,
    })).filter((c) => c.sheetId);
  }
  if (Array.isArray(body.deliverables)) {
    if ((await can(who, 'editDeliverables')) !== 'yes')
      return Response.json({ ok: false, error: 'Only Himanshu and Aashif can change deliverable baselines.' }, { status: 403 });
    patch.deliverables = body.deliverables.map((d, i) => ({
      _key: d._key || 'dl' + Date.now() + i,
      name: String(d.name || '').slice(0, 120),
      target: +d.target || 0,
      period: ['week', 'month', 'year', 'total'].includes(d.period) ? d.period : 'year',
      acceptance: String(d.acceptance || '').slice(0, 500),
    })).filter((d) => d.name);
  }
  if (typeof body.name === 'string') patch.name = body.name.slice(0, 160);

  if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });

  const doc = await sanity(true).patch('project.' + params.slug).set(patch).commit();
  forgetProject(params.slug);

  await sanity(true).create({
    _type: 'activity', at: new Date().toISOString(), who,
    what: 'Edited project settings', target: 'project.' + params.slug,
    detail: Object.keys(patch).join(', '),
  });

  return Response.json({ ok: true, project: doc });
}
