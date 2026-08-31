import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import WorkList from '../../../components/WorkList';
import { canCreateWork, workPerms } from '../../../lib/work';

export const dynamic = 'force-dynamic';

export default async function Work() {
  const who = meSlug();
  const [perms, rights] = await Promise.all([workPerms(who), can(who, 'generate')]);
  let people = [], projects = [], error = null;
  try {
    [people, projects] = await Promise.all([
      sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'),
      sanity(true).fetch('*[_type=="project"]|order(name asc){slug,name,"client":client->name}'),
    ]);
  } catch (e) { error = e.message; }

  return (
    <>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <WorkList who={who} people={people} projects={projects} canCreate={canCreateWork(perms)} perms={perms} rights={rights} />
    </>
  );
}
