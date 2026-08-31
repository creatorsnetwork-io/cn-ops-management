import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import Team from '../../../components/Team';
import { isLate } from '../../../lib/work';
import { can, fullPermTable } from '../../../lib/perm';
import { allowedDomain } from '../../../lib/oauth';

export const dynamic = 'force-dynamic';

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);
const iso = (d) => d.toISOString().slice(0, 10);
function monday(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export default async function Page() {
  const who = meSlug();
  if (!(await pageAllowed(who, '/team'))) return <NotYours what="Team and capacity" />;

  const canEditAccess = (await can(who, 'settings')) === 'yes';
  let rows = [], perm = {}, error = null;
  try {
    const [people, work, permTable] = await Promise.all([
      sanity(true).fetch(
        `*[_type=="person"]|order(active desc, name asc){slug,name,role,email,active,
        "reportsToName": reportsTo->name,
        "projects": *[_type=="project" && owner._ref == ^._id]{slug,name}}`),
      sanity(true).fetch(
        `*[_type=="work" && !(state in ["approved","done"])]{
        title,state,due,needsCraft,"assignee":assignee->slug}`),
      fullPermTable(),
    ]);
    perm = permTable;

    const start = monday();
    const next = new Date(start); next.setUTCDate(next.getUTCDate() + 7);
    const after = new Date(next); after.setUTCDate(after.getUTCDate() + 7);
    const startKey = iso(start), nextKey = iso(next), afterKey = iso(after);

    const capBySlug = Object.fromEntries(await Promise.all(people.map(async (p) => [p.slug, {
      approveCraft: softYes(await can(p.slug, 'approveCraft')),
      shipGate: softYes(await can(p.slug, 'shipGate')),
      triageFeedback: softYes(await can(p.slug, 'triageFeedback')),
    }])));

    rows = people.map((p) => {
      const mine = work.filter((w) => w.assignee === p.slug);
      const cap = capBySlug[p.slug] || {};
      const queue = work.filter((w) => {
        if (w.state === 'craft' || (w.state === 'submitted' && w.needsCraft)) return cap.approveCraft;
        if (w.state === 'ship' || (w.state === 'submitted' && !w.needsCraft)) return cap.shipGate;
        if (w.state === 'client') return cap.triageFeedback;
        return false;
      }).length;
      const thisWeek = mine.filter((w) => w.due && w.due >= startKey && w.due < nextKey);
      const nextWeek = mine.filter((w) => w.due && w.due >= nextKey && w.due < afterKey);
      return {
        ...p, open: mine.length, late: mine.filter((w) => isLate(w)).length, queue,
        comfortable: 3, thisWeek: thisWeek.length, nextWeek: nextWeek.length,
        thisWeekTitles: thisWeek.map((w) => w.title),
      };
    });
  } catch (e) { error = e.message; }

  const start = monday();
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  const weekLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    + ' to ' + end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Capacity</div>
          <h1>Team and capacity</h1>
          <p className="lede">Bandwidth is a screen, not a feeling. Comfortable is the same three-job operating threshold already used by Home.</p>
        </div>
        <button className="btn" disabled>{weekLabel}</button>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <Team rows={rows} canEdit={['himanshu', 'aashif'].includes(who)} canEditAccess={canEditAccess} perm={perm} domain={allowedDomain()} weekLabel={weekLabel} />
    </>
  );
}
