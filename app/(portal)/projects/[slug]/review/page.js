import Link from 'next/link';
import { sanity } from '../../../../../lib/sanity';
import { thisWeek } from '../../../../../lib/calendar';
import WeekReview from '../../../../../components/WeekReview';
import ProjectTabs from '../../../../../components/ProjectTabs';

export const dynamic = 'force-dynamic';

export default async function Review({ params, searchParams }) {
  let p = null, error = null;
  try {
    p = await sanity(true).fetch(`*[_type=="project" && slug==$s][0]{
      slug,name,type,"client":client->name,
      "workCount":count(*[_type=="work" && references(^._id)])
    }`, { s: params.slug });
  } catch (e) { error = e.message; }

  if (error) return <><h1>Weekly review</h1><div className="alert">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h1>{p.name}</h1>
      <p className="lede">One week at a time. Check it, sign the creative, sign the ship gate.</p>
      <ProjectTabs slug={p.slug} type={p.type} on="/review" workCount={p.workCount} />
      <WeekReview slug={p.slug} startWeek={(searchParams && searchParams.week) || thisWeek()} />
    </>
  );
}
