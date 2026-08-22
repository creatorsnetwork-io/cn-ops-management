import Link from 'next/link';
import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import WorkItem from '../../../../components/WorkItem';
import { leadNameOf } from '../../../../lib/escalate';

export const dynamic = 'force-dynamic';

const PROJECTION = `{
  _id, title, kind, state, due, brief, acceptance, driveLink, docLink, needsCraft,
  history, feedback, callSheet,
  "assignee": assignee->slug, "assigneeName": assignee->name,
  "projectSlug": project->slug, "projectName": project->name, "client": project->client->name
}`;

export default async function Page({ params }) {
  const who = meSlug();
  let item = null, people = [], error = null, leadName = null;
  try {
    [item, people, leadName] = await Promise.all([
      sanity(true).fetch(`*[_id==$id][0]${PROJECTION}`, { id: params.id }),
      sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'),
      leadNameOf(who),
    ]);
  } catch (e) { error = e.message; }

  if (error) return <><h1>Work</h1><div className="alertbar">Sanity did not answer. <code>{error}</code></div></>;
  if (!item) return <><h1>Not found</h1><p className="lede">Nothing with that reference. <Link href="/work">Back to work</Link></p></>;

  return (
    <>
      <Link className="btn sm" href="/work">Back to all work</Link>
      <WorkItem initial={item} who={who} people={people} leadName={leadName} canEdit={['himanshu', 'aashif'].includes(who)} />
    </>
  );
}
