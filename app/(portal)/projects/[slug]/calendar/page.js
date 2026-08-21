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
      `*[_type=="project" && slug==$s][0]{slug,name,type,calendarSources,"client":client->name}`, { s: params.slug });
  } catch (e) { error = e.message; }

  if (error) return <><h1>Calendar tracker</h1><div className="alert">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h1>{p.name}</h1>
      <p className="lede">Read live from the sheet. The sheet is untouched.</p>
      <ProjectTabs slug={p.slug} type={p.type} on="/calendar" />
      <Tracker sources={p.calendarSources || []} project={p} canShare={can(meSlug(), 'shareClientLink') === 'yes'} />
    </>
  );
}
