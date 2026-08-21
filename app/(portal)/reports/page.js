import Link from 'next/link';
import { rollupAll } from '../../../lib/rollup';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { meSlug } from '../../../lib/me';

export const dynamic = 'force-dynamic';

export default async function Reports() {
  if (!pageAllowed(meSlug(), '/reports')) return <NotYours what="Reports" />;

  let rows = [], error = null;
  try { rows = await rollupAll(); } catch (e) { error = e.message; }

  const t = rows.reduce((a, r) => ({
    shipped: a.shipped + r.totals.shipped, approved: a.approved + r.totals.approved,
    changes: a.changes + r.totals.changes, waiting: a.waiting + r.totals.waiting,
  }), { shipped: 0, approved: 0, changes: 0, waiting: 0 });

  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const reportState = (r) => {
    if (!r.totals.shipped) return ['Not started', 'mute'];
    if (r.totals.changes) return ['Needs attention', 'bad'];
    if (r.totals.waiting) return ['With client', 'warn'];
    if (r.totals.approved) return ['Approval record ready', 'ok'];
    return ['In progress', 'info'];
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Monthly reporting</div>
          <h1>Reports</h1>
          <p className="lede">
            The team still builds reports in Drive. CN Ops keeps the operational approval record and
            shows exactly what the client has signed off.
          </p>
        </div>
        <button className="btn dark" disabled title="Monthly report creation is not exposed by the current API">New report</button>
      </div>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header>
          <div><h2>This month</h2><div className="sub2">Report links, due dates and report QC are not exposed by the current API.</div></div>
        </header>
        <table className="tbl">
          <thead><tr><th>Client</th><th>Project</th><th>Month</th><th>Due</th><th>Owner</th><th>Drive link</th><th>State</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const state = reportState(r);
              return (
                <tr key={r.slug} className={r.totals.changes ? 'flag' : ''}>
                  <td className="b">{r.client}</td>
                  <td><Link href={'/projects/' + r.slug}>{r.name}</Link></td>
                  <td className="dim">{month}</td>
                  <td className="dim">Not recorded</td>
                  <td className="dim">{r.owner || 'Not assigned'}</td>
                  <td className="dim">Not linked</td>
                  <td><span className={'tag ' + state[1]}>{state[0]}</span></td>
                  <td><Link className="btn sm" href={'/projects/' + r.slug + '/pack'}>Approval record</Link></td>
                </tr>);
            })}
            {rows.length === 0 ? <tr><td colSpan={8} className="empty">No social projects yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="stat" style={{ marginBottom: 14 }}>
        <div><b>{t.shipped}</b><span>submitted</span></div>
        <div><b style={{ color: 'var(--ok)' }}>{t.approved}</b><span>approved</span></div>
        <div><b style={{ color: t.changes ? 'var(--bad)' : undefined }}>{t.changes}</b><span>changes asked</span></div>
        <div><b style={{ color: t.waiting ? 'var(--warn)' : undefined }}>{t.waiting}</b><span>waiting on client</span></div>
      </div>

      <div className="callout">
        <span><b>Report QC needs a report record.</b> The current API does not expose the Drive link, source figures, due date or report approval, so this screen does not pretend that content approval is report approval.</span>
      </div>
    </>
  );
}
