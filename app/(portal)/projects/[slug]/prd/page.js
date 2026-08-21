import Link from 'next/link';
import { sanity } from '../../../../../lib/sanity';
import { meSlug } from '../../../../../lib/me';
import { can } from '../../../../../lib/perm';
import Prd from '../../../../../components/Prd';
import ProjectTabs from '../../../../../components/ProjectTabs';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const who = meSlug();
  let p = null, error = null;
  try {
    p = await sanity(true).fetch(
      `*[_type=="project" && slug==$s][0]{slug,name,type,prd,prdBy,prdAt,prdComments,"client":client->name}`,
      { s: params.slug });
  } catch (e) { error = e.message; }

  if (error) return <><h1>Working document</h1><div className="alert">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  const rights = can(who, 'editPRD');

  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h1>{p.name}</h1>
      <p className="lede">
        One document per project: what it is, what has been decided, what is still open.
        {p.prdAt ? ' Last changed by ' + p.prdBy + '.' : ' Nothing written yet.'}
      </p>
      <ProjectTabs slug={p.slug} type={p.type} on="/prd" />
      <Prd slug={p.slug} initial={p.prd} comments={p.prdComments || []} rights={rights} />
    </>
  );
}
