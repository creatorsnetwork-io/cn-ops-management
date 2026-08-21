import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import Escalations from '../../../components/Escalations';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!pageAllowed(meSlug(), '/escalations')) return <NotYours what="Escalations" />;

  let items = [], error = null;
  const who = meSlug();
  try {
    items = await sanity(true).fetch(
      `*[_type=="escalation"]|order(at desc)[0...200]{_id,at,who,reason,detail,target,
        resolvedAt,resolvedBy,resolution,outcome,takenAt,takenBy,hops,raisedBy,kind,
        "owner":owner->slug,"ownerName":owner->name,
        "projectName":project->name,"projectSlug":project->slug}`);
    items = items.map((e) => ({ ...e, week: (String(e.target || '').match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || null }));
  } catch (e) { error = e.message; }

  let people = [];
  try { people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'); } catch (e) {}
  // Ops see everything. Everyone else sees what they raised or what is theirs to decide.
  const ops = ['himanshu', 'aashif'].includes(who);
  if (!ops) items = items.filter((e) => e.owner === who || e.raisedBy === who);
  const open = items.filter((i) => !i.resolvedAt).length;
  const unowned = items.filter((i) => !i.resolvedAt && !i.owner).length;

  return (
    <>
      <div className="eyebrow">Decisions</div>
      <h1>Escalations</h1>
      <p className="lede">
        {ops ? 'Every time the system needed someone instead of running without them.' : 'Decisions waiting on you, and ones you asked someone else for.'}{' '} {open
          ? open + ' still open' + (unowned ? ', ' + unowned + ' with nobody on it.' : ', all owned.')
          : 'Nothing open right now.'}
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <Escalations items={items} people={people} who={who} canResolve={['himanshu', 'aashif'].includes(who)} />
      <p className="note">
        An override on a ship gate writes one of these automatically. Closing one asks what
        happened, because the point of the list is the pattern, not the individual event.
      </p>
    </>
  );
}
