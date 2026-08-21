import { sanity } from '../../lib/sanity';
import { scopeOf } from '../../lib/perm';
import { KINDS, LABEL, scopeFilter } from '../../lib/work';

const TYPE = {
  social: 'Social retainer', website: 'Website', seo: 'SEO', influencer: 'Influencer campaign',
  video: 'Film or shoot', aiVideo: 'AI video', events: 'Event',
};

const clean = (parts) => parts.filter(Boolean).join(' · ');
const short = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

function add(items, kind, title, meta, href, terms, extra) {
  if (!title || !href) return;
  items.push({ kind, title, meta: meta || '', href, terms: (terms || []).filter(Boolean).join(' '), ...(extra || {}) });
}

export async function buildSearchIndex(who, visibleHrefs) {
  const d = await sanity(true).fetch(`{
    "clients": *[_type=="client" && active != false]|order(name asc){slug,name,code,note},
    "projects": *[_type=="project"]|order(name asc){slug,name,type,cadence,status,
      "client":client->name,"clientSlug":client->slug},
    "work": *[_type=="work"]|order(_updatedAt desc)[0...400]{
      _id,title,kind,state,brief,deliverable,needsCraft,
      "assignee":assignee->slug,"assigneeName":assignee->name,
      "owner":owner->slug,"projectName":project->name,"projectSlug":project->slug,
      "client":project->client->name,"clientSlug":project->client->slug},
    "requests": *[_type=="request"]|order(at desc)[0...300]{
      _id,what,state,channel,"client":client->name,"projectName":project->name},
    "prospects": *[_type=="prospect"]|order(at desc)[0...200]{
      _id,name,market,service,stage,nextStep,source},
    "weeks": *[_type=="weekReview" && (count(flags) > 0 || count(clientDecisions) > 0)]|order(week desc)[0...100]{
      week,projectSlug,flags,clientDecisions,"projectName":project->name,"client":project->client->name},
    "snapshots": *[_type=="snapshot"]|order(at desc)[0...200]{
      _id,week,projectSlug,itemKey,seen,"projectName":review->project->name,"client":review->project->client->name}
  }`);

  const items = [];

  if (visibleHrefs.has('/clients')) {
    for (const c of d.clients || []) {
      add(items, 'Client', c.name, c.note || c.code || 'Client', '/clients/' + c.slug, [c.code, c.note]);
    }
  }

  if (visibleHrefs.has('/projects')) {
    for (const p of d.projects || []) {
      const archived = p.status && p.status !== 'active';
      add(items, archived ? 'Archived' : 'Project', p.name,
        clean([p.client, TYPE[p.type] || p.type, p.cadence]), '/projects/' + p.slug,
        [p.client, p.type, TYPE[p.type], p.cadence, p.status],
        { parentLabel: p.client, parentHref: visibleHrefs.has('/clients') && p.clientSlug ? '/clients/' + p.clientSlug : '' });
    }
  }

  if (visibleHrefs.has('/work')) {
    const s = scopeOf(who);
    const tab = s.all || (s.people || []).length > 1 ? 'all' : 'mine';
    for (const w of scopeFilter(d.work || [], who, tab)) {
      add(items, 'Work item', w.title,
        clean([w.client, w.projectName, LABEL[w.state], w.assigneeName || 'Nobody']), '/work/' + w._id,
        [w.brief, w.deliverable, w.kind, KINDS[w.kind]?.label, w.state, w.assigneeName],
        { parentLabel: w.projectName, parentHref: visibleHrefs.has('/projects') && w.projectSlug ? '/projects/' + w.projectSlug : '' });
    }
  }

  if (visibleHrefs.has('/requests')) {
    for (const r of d.requests || []) {
      add(items, 'Request', short(r.what, 120), clean([r.client, r.projectName, r.state]), '/requests',
        [r.what, r.client, r.projectName, r.state, r.channel]);
    }
  }

  if (visibleHrefs.has('/pipeline')) {
    for (const p of d.prospects || []) {
      add(items, 'Prospect', p.name, clean([p.market, p.service, p.stage]), '/pipeline',
        [p.market, p.service, p.stage, p.nextStep, p.source]);
    }
  }

  for (const w of d.weeks || []) {
    const labels = {};
    for (const f of w.flags || []) if (f.key) labels[f.key] = f.label || f.key;

    if (visibleHrefs.has('/qc')) {
      for (const f of w.flags || []) {
        add(items, 'Caption, QC', f.label || f.key || 'Quality flag', short(f.message, 110),
          '/projects/' + w.projectSlug + '/review?week=' + w.week,
          [f.message, f.code, f.channel, w.projectName, w.client]);
      }
    }

    if (visibleHrefs.has('/feedback')) {
      for (const f of (w.clientDecisions || []).filter((x) => x.decision === 'changes')) {
        add(items, 'Feedback', labels[f.key] || f.key || 'Client feedback', short(f.comment, 110),
          '/projects/' + w.projectSlug + '/review?week=' + w.week,
          [f.comment, f.by, w.projectName, w.client]);
      }
    }
  }

  if (visibleHrefs.has('/calendar')) {
    for (const s of d.snapshots || []) {
      const seen = s.seen || {};
      add(items, 'Calendar row', seen.title || s.itemKey || 'Calendar row',
        clean([s.client, s.projectName, s.week]), '/projects/' + s.projectSlug + '/calendar?week=' + s.week,
        [seen.title, seen.type, seen.captions, seen.creative, s.itemKey]);
    }
  }

  return items;
}
