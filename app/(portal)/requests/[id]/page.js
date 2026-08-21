import Link from 'next/link';
import { sanity } from '../../../../lib/sanity';
import { meSlug } from '../../../../lib/me';
import { pageAllowed } from '../../../../lib/guard';
import { can } from '../../../../lib/perm';
import NotYours from '../../../../components/NotYours';
import RequestDetail from '../../../../components/RequestDetail';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const who = meSlug();
  if (!pageAllowed(who, '/requests')) return <NotYours what="Request detail" />;

  let request = null, projects = [], people = [], error = null;
  try {
    request = await sanity(true).fetch(`*[_type=="request" && _id==$id][0]{
      _id,at,receivedBy,from,channel,what,state,inScope,decision,decidedBy,decidedAt,due,
      "clientSlug":client->slug,"clientName":client->name,
      "projectSlug":project->slug,"projectName":project->name,
      "workId":work->_id,"workTitle":work->title,"workState":work->state}`, { id: decodeURIComponent(params.id) });
    projects = await sanity(true).fetch('*[_type=="project" && client->slug==$c]|order(name asc){slug,name}', { c: request && request.clientSlug });
    people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}');
  } catch (e) { error = e.message; }

  if (error) return <><h1>Request</h1><div className="alertbar">Sanity did not answer. <code>{error}</code></div></>;
  if (!request) return <><h1>Not found</h1><p className="lede"><Link href="/requests">Back to requests</Link></p></>;
  const canTriage = ['yes', 'oversight'].includes(can(who, 'triageFeedback')) || ['himanshu', 'aashif'].includes(who);
  return <RequestDetail request={request} projects={projects} people={people} canTriage={canTriage} />;
}
