import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import Team from '../../../components/Team';
import { isLate } from '../../../lib/work';
import { can } from '../../../lib/perm';
import { allowedDomain } from '../../../lib/oauth';

export const dynamic = 'force-dynamic';

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);

export default async function Page() {
  const who = meSlug();
  if (!pageAllowed(who, '/team')) return <NotYours what="Team and capacity" />;

  let rows = [], error = null;
  try {
    const people = await sanity(true).fetch(
      `*[_type=="person"]|order(active desc, name asc){slug,name,role,email,active,
        "reportsToName": reportsTo->name,
        "projects": *[_type=="project" && owner._ref == ^._id]{slug,name}}`);
    const work = await sanity(true).fetch(
      `*[_type=="work" && !(state in ["approved","done"])]{state,due,needsCraft,"assignee":assignee->slug}`);

    rows = people.map((p) => {
      const mine = work.filter((w) => w.assignee === p.slug);
      const queue = work.filter((w) => {
        if (w.state === 'craft' || (w.state === 'submitted' && w.needsCraft)) return softYes(can(p.slug, 'approveCraft'));
        if (w.state === 'ship' || (w.state === 'submitted' && !w.needsCraft)) return softYes(can(p.slug, 'shipGate'));
        if (w.state === 'client') return softYes(can(p.slug, 'triageFeedback'));
        return false;
      }).length;
      return { ...p, open: mine.length, late: mine.filter((w) => isLate(w)).length, queue };
    });
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="eyebrow">System</div>
      <h1>Team and capacity</h1>
      <p className="lede">Who reports to whom, and what each person is actually carrying right now.</p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <Team rows={rows} canEdit={['himanshu', 'aashif'].includes(who)} domain={allowedDomain()} />
    </>
  );
}
