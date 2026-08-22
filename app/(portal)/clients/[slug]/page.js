import Link from 'next/link';
import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import { pageAllowed } from '../../../../lib/guard';
import NotYours from '../../../../components/NotYours';
import ClientDetail from '../../../../components/ClientDetail';
import { evaluate } from '../../../../lib/onboard';

export const dynamic = 'force-dynamic';

function projectHealth(p) {
  if (p.status && p.status !== 'active') return 'Closed';
  if (p.escalations || p.late) return 'Needs attention';
  if (p.type === 'social' && !p.cals) return 'Watch';
  return 'On track';
}

export default async function Page({ params }) {
  const who = meSlug();
  if (!pageAllowed(who, '/clients')) return <NotYours what="Clients" />;

  const today = new Date().toISOString().slice(0, 10);
  let c = null, error = null, links = 0;
  try {
    c = await sanity(true).fetch(
      `*[_type=="client" && slug==$s][0]{
        slug, name, note, driveFolderId, logoUrl, contacts, obligations, onbManual,
        channel, turnaround, renewal, clientType, industry, businessType,
        "projects": *[_type=="project" && references(^._id)]|order(name asc){
          slug, name, type, status, voice, prd, contract, deliverables,
          "owner": owner->name, "cals": count(calendarSources[current==true]),
          "late": count(*[_type=="work" && references(^._id)
                && !(state in ["approved","done"]) && defined(due) && due < $today]),
          "escalations": count(*[_type=="escalation" && references(^._id) && !defined(resolvedAt)]),
          "workApproved": count(*[_type=="work" && references(^._id) && state in ["approved","done"]])},
        "briefs": count(*[_type=="work" && project->client->slug == ^.slug && defined(brief) && brief != ""]),
        "late": count(*[_type=="work" && project->client->slug == ^.slug
              && !(state in ["approved","done"]) && defined(due) && due < $today]),
        "escalations": count(*[_type=="escalation" && project->client->slug == ^.slug && !defined(resolvedAt)]),
        "requests": count(*[_type=="request" && client->slug == ^.slug && state=="new"])
      }`, { s: params.slug, today });

    if (c) {
      const slugs = (c.projects || []).map((p) => p.slug);
      const weeks = await sanity(true).fetch(
        '*[_type=="weekReview" && projectSlug in $s]{projectSlug, clientDecisions, clientToken}', { s: slugs });
      links = weeks.filter((w) => w.clientToken != null).length;
      const approvedBy = {};
      for (const w of weeks) {
        approvedBy[w.projectSlug] = (approvedBy[w.projectSlug] || 0)
          + (w.clientDecisions || []).filter((d) => d.decision === 'approved').length;
      }
      c.projects = (c.projects || []).map((p) => ({
        ...p,
        target: (p.deliverables || []).reduce((a, d) => a + (+d.target || 0), 0),
        approved: (approvedBy[p.slug] || 0) + (p.workApproved || 0),
        health: projectHealth(p),
      }));
    }
  } catch (e) { error = e.message; }

  if (error) return <><h1>Client</h1><div className="alertbar">Sanity did not answer. <code>{error}</code></div></>;
  if (!c) return <><h1>Not found</h1><p className="lede"><Link href="/clients">Back to clients</Link></p></>;

  const onb = evaluate(c);
  c.typeLabel = c.clientType || c.industry || c.businessType || 'Client type not set';
  c.brain = onb.done[2] ? 'Written' : 'Missing';

  return <ClientDetail c={c} onb={onb} links={links} who={who} canEdit={['himanshu', 'aashif'].includes(who)} />;
}
