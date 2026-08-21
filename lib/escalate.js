import { sanity } from './sanity';

// Everything routes to the person you report to. Himanshu reports to nobody, so
// anything that reaches him has nowhere further to go, which is the point.
export async function leadOf(slug) {
  const p = await sanity(true).fetch('*[_id==$id][0]{"lead":reportsTo->slug}', { id: 'person.' + slug });
  return (p && p.lead) || null;
}

export async function leadNameOf(slug) {
  const p = await sanity(true).fetch('*[_id==$id][0]{"lead":reportsTo->name}', { id: 'person.' + slug });
  return (p && p.lead) || null;
}

// Raise one. Owner is the raiser's lead, never automatically the founder.
export async function raiseEscalation({ who, reason, detail, projectSlug, workId, kind, target }) {
  const c = sanity(true);
  const now = new Date().toISOString();
  const lead = (await leadOf(who)) || who;
  return c.create({
    _type: 'escalation', at: now, who, raisedBy: who,
    kind: kind || 'manual',
    reason: String(reason || '').slice(0, 200),
    detail: String(detail || '').slice(0, 1500),
    target: target || workId || '',
    owner: { _type: 'reference', _ref: 'person.' + lead },
    takenAt: now, takenBy: 'routing',
    hops: [{ _key: 'h' + Date.now(), at: now, from: who, to: lead, note: 'Raised' }],
    project: projectSlug ? { _type: 'reference', _ref: 'project.' + projectSlug } : undefined,
    work: workId ? { _type: 'reference', _ref: workId, _weak: true } : undefined,
  });
}

// Hours something has been sitting with whoever holds it now.
export function sittingHours(e) {
  const last = (e.hops || []).length ? (e.hops || [])[(e.hops || []).length - 1].at : e.at;
  if (!last) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(last).getTime()) / 3600000));
}
