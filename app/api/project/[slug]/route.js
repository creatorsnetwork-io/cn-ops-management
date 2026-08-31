import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import { can } from '../../../../lib/perm';
import { forgetProject, log } from '../../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req, { params }) {
  const who = meSlug();
  const body = await req.json();

  // Closing is its own thing, not a field edit: it needs a reason, a
  // permission of its own, and never reopens what it just closed.
  if (body.close) {
    if ((await can(who, 'closeProject')) !== 'yes')
      return Response.json({ ok: false, error: 'Only Himanshu or Aashif can close a project.' }, { status: 403 });
    const reason = String(body.close.reason || '').trim();
    if (!reason)
      return Response.json({ ok: false, error: 'Write why this is closing now. That is the part of a closure worth keeping.' }, { status: 400 });

    const now = new Date().toISOString();
    const doc = await sanity(true).patch('project.' + params.slug)
      .set({ status: 'closed', closedAt: now, closedBy: who, closedReason: reason.slice(0, 600) })
      .commit();
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
