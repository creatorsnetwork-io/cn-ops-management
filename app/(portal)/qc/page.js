import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';

export const dynamic = 'force-dynamic';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

export default async function QC() {
  if (!pageAllowed(meSlug(), '/qc')) return <NotYours what="QC flags" />;

  let weeks = [], error = null;
  try {
    weeks = await sanity(true).fetch(
      `*[_type=="weekReview" && count(flags) > 0]|order(week desc)[0...40]{
        week, projectSlug, flags, qcAt, qcBy, "shipped": shipGate.at,
        "projectName": project->name, "client": project->client->name }`);
  } catch (e) { error = e.message; }

  const rows = weeks.map((w) => ({
    ...w,
    blocking: (w.flags || []).filter((f) => f.severity === 'block'),
    advisory: (w.flags || []).filter((f) => f.severity !== 'block'),
  }));
  const totalBlock = rows.reduce((a, r) => a + r.blocking.length, 0);
  const open = rows.filter((r) => !r.shipped);

  return (
    <>
      <div className="eyebrow">Quality</div>
      <h1>QC flags</h1>
      <p className="lede">
        Every check the system raised, newest week first. Blocking flags stop a ship gate.
        Advisory ones do not, they are there so nobody can say they did not know.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header><h2>Right now</h2></header>
        <div style={{ padding: '14px 16px' }}>
          <div className="stat">
            <div><b style={{ color: totalBlock ? 'var(--bad)' : 'var(--ok)' }}>{totalBlock}</b><span>blocking</span></div>
            <div><b>{rows.reduce((a, r) => a + r.advisory.length, 0)}</b><span>worth a look</span></div>
            <div><b>{open.length}</b><span>weeks not yet shipped</span></div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel"><div className="empty">
          Nothing checked yet. Open a project's weekly review and press Run quality checks.
        </div></div>) : null}

      {rows.map((r) => (
        <div className="panel" key={r.projectSlug + r.week}>
          <header>
            <h2>{r.projectName}, week of {dayOf(r.week)}</h2>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {r.blocking.length ? <span className="tag bad">{r.blocking.length} blocking</span> : <span className="tag ok">nothing blocking</span>}
              {r.shipped ? <span className="tag ok">shipped</span> : <span className="tag mute">not shipped</span>}
              <Link className="btn sm" href={'/projects/' + r.projectSlug + '/review?week=' + r.week}>Open the week</Link>
            </span>
          </header>
          <table className="tbl">
            <thead><tr><th style={{ width: 96 }}>Severity</th><th style={{ width: 280 }}>Which post</th><th>What is wrong</th></tr></thead>
            <tbody>
              {(r.flags || []).slice()
                .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'block' ? -1 : 1))
                .map((f, n) => (
                  <tr key={n}>
                    <td><span className={'tag ' + (f.severity === 'block' ? 'bad' : 'warn')}>{f.severity === 'block' ? 'blocking' : 'check'}</span></td>
                    <td>{f.label || f.key}</td>
                    <td>{f.message}</td>
                  </tr>))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            Checked {when(r.qcAt)} by {r.qcBy}. Re-running the checks on the week replaces this list.
          </div>
        </div>))}
    </>
  );
}
