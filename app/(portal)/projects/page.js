import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { ProjectsBrowse } from '../../../components/Browse';

export const dynamic = 'force-dynamic';

export default async function Projects() {
  const who = meSlug();
  if (!pageAllowed(who, '/projects')) return <NotYours what="Projects" />;

  const today = new Date().toISOString().slice(0, 10);
  let rows = [], clients = [], people = [], favs = [], error = null;

  try {
    const raw = await sanity(true).fetch(
      `*[_type=="project"]|order(client->name asc, name asc){
        slug, name, type, cadence, status, deliverables,
        "client": client->name, "clientSlug": client->slug, "owner": owner->name,
        "cals": count(calendarSources[current==true]),
        "late": count(*[_type=="work" && references(^._id) && !(state in ["approved","done"]) && defined(due) && due < $today]),
        "workApproved": count(*[_type=="work" && references(^._id) && state in ["approved","done"]]),
        "escalations": count(*[_type=="escalation" && references(^._id) && !defined(resolvedAt)])
      }`, { today });

    const weeks = await sanity(true).fetch(
      '*[_type=="weekReview"]{projectSlug, clientDecisions}');
    const approvedByProject = {};
    for (const w of weeks) {
      const n = (w.clientDecisions || []).filter((d) => d.decision === 'approved').length;
      approvedByProject[w.projectSlug] = (approvedByProject[w.projectSlug] || 0) + n;
    }

    rows = raw.map((p) => {
      const target = (p.deliverables || []).reduce((a, d) => a + (+d.target || 0), 0);
      const approved = (approvedByProject[p.slug] || 0) + (p.workApproved || 0);
      const health = p.status !== 'active' ? 'Closed'
        : (p.escalations || p.late) ? 'Needs attention'
        : (p.type === 'social' && !p.cals) ? 'Watch'
        : 'On track';
      return { ...p, target, approved, health };
    });

    clients = await sanity(true).fetch('*[_type=="client" && active != false]|order(name asc){slug,name}');
    people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}');
    const me = await sanity(true).fetch('*[_id==$id][0]{favProjects}', { id: 'person.' + who });
    favs = (me && me.favProjects) || [];
  } catch (e) { error = e.message; }

  return (
    <>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <ProjectsBrowse who={who} rows={rows} clients={clients} people={people} favs={favs} />
    </>
  );
}
