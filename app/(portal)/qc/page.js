import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { can } from '../../../lib/perm';
import QCDashboard from '../../../components/QCDashboard';

export const dynamic = 'force-dynamic';

export default async function QC() {
  const who = meSlug();
  if (!(await pageAllowed(who, '/qc'))) return <NotYours what="QC flags" />;

  let weeks = [], error = null;
  try {
    weeks = await sanity(true).fetch(
      `*[_type=="weekReview"]|order(week desc)[0...80]{
        week, projectSlug, flags, qcAt, shipped,
        "projectName": project->name, "client": project->client->name }`);
  } catch (e) { error = e.message; }

  const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);
  const [craftShade, shipShade, triageShade] = await Promise.all([can(who, 'approveCraft'), can(who, 'shipGate'), can(who, 'triageFeedback')]);
  const canWaive = softYes(craftShade) || softYes(shipShade) || softYes(triageShade);

  return (
    <>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <QCDashboard initialWeeks={weeks} canWaive={canWaive} />
    </>
  );
}
