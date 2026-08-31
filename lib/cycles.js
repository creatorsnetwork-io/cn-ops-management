import { sanity } from './sanity';

// Cadences, and what each one actually is:
//   weekly    a week of a content calendar, already built
//   monthly   a month with a report at the end of it, used for SEO
//   milestone a named thing that lands on a date, used for websites and campaigns
//   perAsset  one asset at a time, which is just a work item, so nothing new is needed

export const thisMonth = (d) => (d || new Date()).toISOString().slice(0, 7);
export const monthLabel = (m) =>
  new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const shiftMonth = (m, n) => {
  const d = new Date(m + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
export const cycleId = (slug, month) => 'month.' + slug + '.' + month;

export async function loadCycle(slug, month) {
  return sanity(true).fetch('*[_id==$id][0]', { id: cycleId(slug, month) });
}

export async function ensureCycle(slug, month) {
  const id = cycleId(slug, month);
  const e = await loadCycle(slug, month);
  if (e) return e;
  await sanity(true).createIfNotExists({
    _id: id, _type: 'monthCycle', projectSlug: slug, month,
    project: { _type: 'reference', _ref: 'project.' + slug },
    reportLink: '', reportLinkAt: null, reportLinkBy: null, notes: '', shipGate: null, clientAck: null,
    brainstormAt: null, ideasSentAt: null, ideasApprovedAt: null,
  });
  return loadCycle(slug, month);
}

export const MILESTONE_STATES = ['planned', 'progress', 'delivered', 'approved'];
export const MILESTONE_LABEL = {
  planned: 'Planned', progress: 'In progress', delivered: 'Delivered', approved: 'Client approved',
};
