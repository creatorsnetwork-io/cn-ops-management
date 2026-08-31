import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import ClientLinks from '../../../components/ClientLinks';

export const dynamic = 'force-dynamic';

export default async function Links() {
  const who = meSlug();
  if (!(await pageAllowed(who, '/links'))) return <NotYours what="Client links" />;

  let rows = [], shares = [], error = null;
  try {
    const [main, shared] = await Promise.all([
      Promise.all([
        sanity(true).fetch(
          `*[_type=="weekReview" && defined(clientToken)]|order(week desc)[0...80]{
          _id, week, projectSlug, clientToken, sharedAt, clientDecisions, firstOpenedAt, lastOpenedAt,
          "projectName": project->name, "client": project->client->name }`),
        sanity(true).fetch(
          `*[_type=="activity" && what in ["Created the client link","Reopened the client link"]]|order(at desc){target,who}`),
      ]).then(([raw, activity]) => ({ raw, activity })).catch((e) => ({ error: e })),
      sanity(true).fetch(
        `*[_type=="share" && revoked != true]|order(at desc)[0...80]{
        token, kind, at, by, responses, workId, firstOpenedAt, lastOpenedAt,
        "title": work->title, "projectName": work->project->name, "client": work->project->client->name}`)
        .catch(() => []),
    ]);
    shares = shared;
    if (main.error) error = main.error.message;
    else {
      const sender = {};
      for (const a of main.activity) if (!sender[a.target]) sender[a.target] = a;
      rows = main.raw.map((r) => ({
        ...r,
        by: sender[r._id]?.who || '',
        approved: (r.clientDecisions || []).filter((d) => d.decision === 'approved').length,
        changes: (r.clientDecisions || []).filter((d) => d.decision === 'changes').length,
        clientDecisions: undefined,
      }));
    }
  } catch (e) { error = e.message; }

  const canRevoke = (await can(who, 'shareClientLink')) === 'yes';

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Tokenised, no login</div>
          <h1>Client links</h1>
          <p className="lede">
            Every live client review, freelancer brief and crew call sheet, with the actions that created it.
          </p>
        </div>
        <a className="btn dark" href="/work">New link</a>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <ClientLinks rows={rows} shares={shares} canRevoke={canRevoke} />
    </>
  );
}
