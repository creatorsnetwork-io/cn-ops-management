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

  return (
    <>
      <div className="eyebrow">Records</div>
      <h1>Reports</h1>
      <p className="lede">What has actually been signed off, per client. Only client approvals count.</p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header><h2>Across every retainer</h2></header>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
          <div className="stat">
            <div><b>{t.shipped}</b><span>submitted</span></div>
            <div><b style={{ color: 'var(--ok)' }}>{t.approved}</b><span>approved</span></div>
            <div><b style={{ color: t.changes ? 'var(--bad)' : undefined }}>{t.changes}</b><span>changes asked</span></div>
            <div><b style={{ color: t.waiting ? 'var(--warn)' : undefined }}>{t.waiting}</b><span>waiting on the client</span></div>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Project</th><th>Client</th><th>Owner</th><th>Weeks shipped</th><th>Submitted</th><th>Approved</th><th>Changes</th><th>Waiting</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td><Link href={'/projects/' + r.slug}>{r.name}</Link></td>
                <td>{r.client}</td>
                <td>{r.owner || '—'}</td>
                <td>{r.rows.filter((w) => w.shipAt).length}</td>
                <td>{r.totals.shipped}</td>
                <td>{r.totals.approved ? <span className="tag ok">{r.totals.approved}</span> : '—'}</td>
                <td>{r.totals.changes ? <span className="tag bad">{r.totals.changes}</span> : '—'}</td>
                <td>{r.totals.waiting ? <span className="tag warn">{r.totals.waiting}</span> : '—'}</td>
                <td><Link className="btn sm" href={'/projects/' + r.slug + '/pack'}>Record</Link></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={9} className="empty">No social projects yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="note">
        Nothing here is typed in. Submitted counts the posts in a week when its ship gate was signed,
        approved counts what the client pressed approve on. The gap is time on their side.
      </p>
    </>
  );
}
