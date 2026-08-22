import Link from 'next/link';
import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import { can } from '../../../../lib/perm';
import ProjectDetail from '../../../../components/ProjectDetail';

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
const CADENCE = { weekly: 'Weekly', monthly: 'Monthly', milestone: 'Milestone', perAsset: 'Per asset' };

function stageOf(p) {
  if (p.stage) return p.stage;
  if (p.status && p.status !== 'active') return 'Closed';
  const stages = STAGES[p.type] || ['Plan', 'Production', 'Client', 'Approved'];
  const review = (p.reviews || [])[0];
  if (review) {
    const decisions = review.clientDecisions || [];
    if (review.shipped && decisions.filter((d) => d.decision === 'approved').length >= review.shipped) return stages[Math.max(0, stages.length - 2)];
    if (review.clientToken || review.shipGate) return stages.includes('Client') ? 'Client' : stages[Math.max(0, stages.length - 2)];
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

export default async function Project({ params, searchParams }) {
  const who = meSlug();
  const requestedTab = searchParams && searchParams.tab;
  const activeTab = ['overview', 'ideas', 'deliverables', 'work', 'activity'].includes(requestedTab)
    ? requestedTab : 'overview';
  let p = null, activity = [], error = null;
  try {
    const [project, all] = await Promise.all([
      sanity(true).fetch(
        `*[_type=="project" && slug==$s][0]{
        _id,slug,name,type,cadence,status,subtitle,term,timeline,stage,ideasDoc,ideasLink,
        calendarSources,deliverables,contract,milestones,prd,voice,
        "client":client->{name,code,driveFolderId},"owner":owner->{name},
        ${activeTab === 'work' ? '"people": *[_type=="person" && active==true]|order(name asc){slug,name},' : ''}
        ${activeTab === 'activity' ? '"escalations": *[_type=="escalation" && project->slug == ^.slug]{_id},' : ''}
        "workCount": count(*[_type=="work" && references(^._id)]),
        "work": *[_type=="work" && references(^._id)]|order(due asc)[0...200]{
          _id,title,kind,state,due,deliverable,feedback,driveLink,firstTime,needsCraft,
          "assignee":assignee->slug,"assigneeName":assignee->name,"owner":owner->slug},
        "reviews": *[_type=="weekReview" && projectSlug == ^.slug]|order(week desc)[0...100]{
          _id,week,shipped,clientToken,clientDecisions,flags,items,craftGate,shipGate},
        "cycles": *[_type=="monthCycle" && projectSlug == ^.slug]|order(month desc)[0...24]{
          _id,brainstormAt,ideasSentAt,ideasApprovedAt,reportLink},
        "requests": *[_type=="request" && project->slug == ^.slug]{_id,state}
      }`, { s: params.slug }),
      activeTab === 'activity'
        ? sanity(true).fetch('*[_type=="activity"]|order(at desc)[0...500]{_id,at,who,what,detail,target}')
        : Promise.resolve([]),
    ]);
    p = project;
    if (p && activeTab === 'activity') {
      const targets = new Set([
        p._id,
        ...(p.work || []).map((w) => w._id),
        ...(p.reviews || []).map((w) => w._id),
        ...(p.cycles || []).map((c) => c._id),
        ...(p.requests || []).map((r) => r._id),
        ...(p.escalations || []).map((e) => e._id),
      ]);
      const prefixes = ['week.' + p.slug + '.', 'month.' + p.slug + '.', p.slug + ':'];
      activity = all.filter((a) => targets.has(a.target) || prefixes.some((x) => String(a.target || '').startsWith(x)));
    }
  } catch (e) { error = e.message; }

  if (error) return <><h1>Project</h1><div className="alertbar">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede">No project with the name <code>{params.slug}</code>. <Link href="/projects">Back to projects</Link></p></>;

  p.target = (p.deliverables || []).reduce((a, d) => a + (+d.target || 0), 0);
  const socialApproved = (p.reviews || []).reduce((n, r) => n + (r.clientDecisions || []).filter((d) => d.decision === 'approved').length, 0);
  const workApproved = (p.work || []).filter((w) => ['approved', 'done'].includes(w.state)).length;
  p.approved = socialApproved + workApproved;
  p.subtitle = p.subtitle || SUBTITLE[p.type] || 'Project engagement';
  p.term = p.term || (['weekly', 'monthly'].includes(p.cadence) ? 'Recurring' : 'Fixed term');
  p.timeline = timelineOf(p);
  p.stage = stageOf(p);
  p.cadenceLabel = CADENCE[p.cadence] || p.cadence || 'Not set';
  p.hasClientAccess = (p.reviews || []).some((r) => r.clientToken);
  p.signals = {
    qc: (p.reviews || []).reduce((n, r) => n + (r.flags || []).filter((f) => !f.waived).length, 0),
    feedback: (p.reviews || []).reduce((n, r) => n + (r.clientDecisions || []).filter((d) => d.decision === 'changes').length, 0)
      + (p.work || []).reduce((n, w) => n + (w.feedback || []).filter((f) => !f.resolved).length, 0),
    requests: (p.requests || []).filter((r) => r.state === 'new').length,
    reports: (p.reviews || []).filter((r) => r.shipGate).length + (p.cycles || []).filter((c) => c.reportLink).length,
  };

  const perms = {
    canShare: can(who, 'shareClientLink') === 'yes',
    canClose: can(who, 'closeProject') === 'yes',
    canUploadContract: can(who, 'uploadContract') === 'yes',
    canEditDeliverables: can(who, 'editDeliverables') === 'yes',
    canEditCalendar: can(who, 'editCalendarSources') === 'yes',
    canCreateWork: can(who, 'createWork') !== 'no',
    canAddMilestone: ['himanshu', 'aashif'].includes(who),
    canMarkIdeas: ['himanshu', 'aashif', 'priyanka'].includes(who),
  };

  return <ProjectDetail p={p} activity={activity} perms={perms} activeTab={activeTab} who={who} />;
}
