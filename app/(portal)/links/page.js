import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import ClientLinks from '../../../components/ClientLinks';

export const dynamic = 'force-dynamic';

export default async function Links() {
  const who = meSlug();
  if (!pageAllowed(who, '/links')) return <NotYours what="Client links" />;

  let rows = [], error = null;
  try {
    const raw = await sanity(true).fetch(
      `*[_type=="weekReview" && defined(clientToken)]|order(week desc)[0...80]{
        week, projectSlug, clientToken, sharedAt, clientDecisions,
        "projectName": project->name, "client": project->client->name }`);
    rows = raw.map((r) => ({
      ...r,
      approved: (r.clientDecisions || []).filter((d) => d.decision === 'approved').length,
      changes: (r.clientDecisions || []).filter((d) => d.decision === 'changes').length,
      clientDecisions: undefined,
    }));
  } catch (e) { error = e.message; }

  let shares = [];
  try {
    shares = await sanity(true).fetch(
      `*[_type=="share" && revoked != true]|order(at desc)[0...80]{
        token, kind, at, by, responses, workId,
        "title": work->title, "projectName": work->project->name, "client": work->project->client->name}`);
  } catch (e) {}

  return (
    <>
      <div className="eyebrow">Records</div>
      <h1>Links out</h1>
      <p className="lede">
        Every link currently reachable by someone without a login: clients reviewing a week,
        freelancers holding a brief, crew holding a call sheet.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <ClientLinks rows={rows} shares={shares} canRevoke={can(who, 'shareClientLink') === 'yes'} />
    </>
  );
}
