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
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <Requests clients={clients} projects={projects} people={people} />
    </>
  );
}
