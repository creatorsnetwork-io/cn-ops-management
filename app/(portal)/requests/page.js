import { sanity } from '../../../lib/sanity';
import Requests from '../../../components/Requests';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { meSlug } from '../../../lib/me';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!pageAllowed(meSlug(), '/requests')) return <NotYours what="Requests" />;

  let clients = [], projects = [], people = [], error = null;
  try {
    clients = await sanity(true).fetch('*[_type=="client" && active==true]|order(name asc){slug,name}');
    projects = await sanity(true).fetch('*[_type=="project"]|order(name asc){slug,name,"clientSlug":client->slug}');
    people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}');
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="eyebrow">Inbound</div>
      <h1>Requests</h1>
      <p className="lede">
        Anything a client asked for that was not in the plan. Log it in ten seconds, then decide
        whether it is inside the retainer or not.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <Requests clients={clients} projects={projects} people={people} />
    </>
  );
}
