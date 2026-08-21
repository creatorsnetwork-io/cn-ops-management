import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import WorkList from '../../../components/WorkList';
import { canCreateWork } from '../../../lib/work';

export const dynamic = 'force-dynamic';

export default async function Work() {
  const who = meSlug();
  let people = [], projects = [], error = null;
  try {
    people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}');
    projects = await sanity(true).fetch('*[_type=="project"]|order(name asc){slug,name,"client":client->name}');
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="eyebrow">Workspace</div>
      <h1>Work</h1>
      <p className="lede">
        Everything that is not a social calendar: pages, articles, reports, films, campaigns.
        Each one has a state and a next step, and only the people it concerns can move it.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <WorkList who={who} people={people} projects={projects} canCreate={canCreateWork(who)} />
    </>
  );
}
