import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { ProjectsBrowse } from '../../../components/Browse';

export const dynamic = 'force-dynamic';

const STAGES = {
  social: ['Plan', 'Ideas', 'Copy', 'Creative', 'QC', 'Client', 'Approved', 'Posted'],
  website: ['PRD', 'Wireframe', 'Design', 'Build', 'Content', 'QA', 'Launch'],
  seo: ['Plan', 'Execute', 'Fixes', 'Report'],
  influencer: ['Brief', 'Shortlist', 'Client approves', 'Briefs sent', 'Content in', 'QC', 'Client', 'Posted', 'Report'],
  video: ['Brief', 'Script', 'Pre-production', 'Shoot', 'Edit', 'QC', 'Client', 'Masters'],
  aiVideo: ['Brief', 'Script', 'References', 'Generate', 'Assembly', 'QC', 'Client', 'Masters'],
  events: ['Brief', 'Plan', 'Production', 'Delivery', 'Client', 'Report'],
};

const SUBTITLE = {
  social: 'Monthly retainer', website: 'Website delivery', seo: 'SEO and maintenance',
  influencer: 'Creator campaign', video: 'Film or shoot', aiVideo: 'AI generated film', events: 'Event delivery',
};

function stageOf(p) {
  if (p.stage) return p.stage;
  if (p.status && p.status !== 'active') return 'Closed';
  const stages = STAGES[p.type] || ['Plan', 'Production', 'Client', 'Approved'];
  const review = (p.reviews || [])[0];
  if (review) {
    const decisions = review.clientDecisions || [];
    if (review.shipped && decisions.filter((d) => d.decision === 'approved').length >= review.shipped) return stages[Math.max(0, stages.length - 2)];
    if (review.clientToken) return stages.includes('Client') ? 'Client' : stages[Math.max(0, stages.length - 2)];
    if (review.shipGate) return stages.includes('Client') ? 'Client' : stages[Math.max(0, stages.length - 2)];
    if ((review.flags || []).some((f) => !f.waived)) return stages.includes('QC') ? 'QC' : stages[Math.max(0, stages.length - 3)];
    if (review.craftGate || (review.items || []).length) return stages.includes('Creative') ? 'Creative' : stages[Math.max(0, stages.length - 3)];
  }
  const cycle = (p.cycles || [])[0];
  if (cycle?.ideasApprovedAt && stages.includes('Copy')) return 'Copy';
  if ((cycle?.ideasSentAt || cycle?.brainstormAt) && stages.includes('Ideas')) return 'Ideas';
  const rank = { briefed: 1, progress: 2, submitted: 3, craft: 4, ship: 5, client: 6, approved: 7, done: 8 };
  const workRank = Math.max(0, ...(p.work || []).map((w) => rank[w.state] || 0));
  if (!workRank) return stages[0];
  return stages[Math.min(stages.length - 1, Math.max(0, workRank - 1))];
}

function timelineOf(p) {
  if (p.timeline) return p.timeline;
  const dates = (p.work || []).map((w) => w.due)
    .concat((p.milestones || []).map((m) => m.due)).filter(Boolean).sort();
  const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  if (dates.length > 1) return fmt(dates[0]) + ' to ' + fmt(dates[dates.length - 1]);
  if (dates.length === 1) return 'Due ' + fmt(dates[0]);
  if (['weekly', 'monthly'].includes(p.cadence)) {
    return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ', recurring';
  }
  return 'Timeline not set';
}

export default async function Projects({ searchParams }) {
  const who = meSlug();
  if (!pageAllowed(who, '/projects')) return <NotYours what="Projects" />;

  const today = new Date().toISOString().slice(0, 10);
  let rows = [], clients = [], people = [], favs = [], error = null;

  try {
    const raw = await sanity(true).fetch(
      `*[_type=="project"]|order(client->name asc, name asc){
        slug, name, type, cadence, status, deliverables, milestones,
        subtitle, term, timeline, stage,
        "client": client->name, "clientSlug": client->slug, "owner": owner->name,
        "cals": count(calendarSources[current==true]),
        "work": *[_type=="work" && project->slug == ^.slug]{state,due,deliverable},
        "reviews": *[_type=="weekReview" && projectSlug == ^.slug]|order(week desc)[0...1]{
          week,shipped,clientToken,clientDecisions,flags,items,craftGate,shipGate},
        "cycles": *[_type=="monthCycle" && projectSlug == ^.slug]|order(month desc)[0...1]{
          month,brainstormAt,ideasSentAt,ideasApprovedAt},
        "late": count(*[_type=="work" && references(^._id) && !(state in ["approved","done"]) && defined(due) && due < $today]),
        "workApproved": count(*[_type=="work" && references(^._id) && state in ["approved","done"]]),
        "escalations": count(*[_type=="escalation" && references(^._id) && !defined(resolvedAt)])
      }`, { today });

    const weeks = await sanity(true).fetch(
      '*[_type=="weekReview"]{projectSlug, clientDecisions}');
    const approvedByProject = {};
    for (const w of weeks) {
      const n = (w.clientDecisions || []).filter((d) => d.decision === 'approved').length;
      approvedByProject[w.projectSlug] = (approvedByProject[w.projectSlug] || 0) + n;
    }

    rows = raw.map((p) => {
      const target = (p.deliverables || []).reduce((a, d) => a + (+d.target || 0), 0);
      const approved = (approvedByProject[p.slug] || 0) + (p.workApproved || 0);
      const health = p.status !== 'active' ? 'Closed'
        : (p.escalations || p.late) ? 'Needs attention'
        : (p.type === 'social' && !p.cals) ? 'Watch'
        : 'On track';
      return {
        ...p,
        target,
        approved,
        health,
        subtitle: p.subtitle || SUBTITLE[p.type] || 'Project engagement',
        term: p.term || (['weekly', 'monthly'].includes(p.cadence) ? 'Recurring' : 'Fixed term'),
        timeline: timelineOf(p),
        stage: stageOf(p),
      };
    });

    clients = await sanity(true).fetch('*[_type=="client" && active != false]|order(name asc){slug,name}');
    people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}');
    const me = await sanity(true).fetch('*[_id==$id][0]{favProjects}', { id: 'person.' + who });
    favs = (me && me.favProjects) || [];
  } catch (e) { error = e.message; }

  const initialClient = clients.some((c) => c.slug === searchParams?.client) ? searchParams.client : '';

  return (
    <>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <ProjectsBrowse who={who} rows={rows} clients={clients} people={people} favs={favs}
        openAdd={searchParams?.add === '1'} initialClient={initialClient} />
    </>
  );
}
