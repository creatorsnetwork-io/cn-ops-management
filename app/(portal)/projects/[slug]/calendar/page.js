import Link from 'next/link';
import { sanity } from '../../../../../lib/sanity';
import Tracker from '../../../../../components/Tracker';
import ProjectTabs from '../../../../../components/ProjectTabs';
import { meSlug } from '../../../../../lib/me';
import { can } from '../../../../../lib/perm';

export const dynamic = 'force-dynamic';

export default async function ProjectCalendar({ params }) {
  let p = null, error = null;
  try {
    p = await sanity(true).fetch(
      `*[_type=="project" && slug==$s][0]{
        slug,name,type,calendarSources,"client":client->name,
        "workCount":count(*[_type=="work" && references(^._id)])
      }`, { s: params.slug });
  } catch (e) { error = e.message; }

  if (error) return <><h1>Calendar tracker</h1><div className="alertbar">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  const canShare = (await can(meSlug(), 'shareClientLink')) === 'yes';

  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h1>{p.name}</h1>
      <p className="lede">Read live from the sheet. The sheet is untouched.</p>
      <ProjectTabs slug={p.slug} type={p.type} on="/calendar" workCount={p.workCount} />
      <Tracker sources={p.calendarSources || []} project={p} canShare={canShare} />
    </>
  );
}
