import Link from 'next/link';
import { sanity } from '../../../../../lib/sanity';
import CountReport from '../../../../../components/CountReport';
import ProjectTabs from '../../../../../components/ProjectTabs';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  let p = null;
  try {
    p = await sanity(true).fetch(`*[_type=="project" && slug==$s][0]{
      slug,name,type,"client":client->name,
      "workCount":count(*[_type=="work" && references(^._id)])
    }`, { s: params.slug });
  } catch (e) {}
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h1>{p.name}</h1>
      <p className="lede">How much has actually been produced, counted across every year of calendar.</p>
      <ProjectTabs slug={p.slug} type={p.type} on="/count" workCount={p.workCount} />
      <CountReport slug={p.slug} />
    </>
  );
}
