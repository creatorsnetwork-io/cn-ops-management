import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';

export const dynamic = 'force-dynamic';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');
const ago = (t) => {
  if (!t) return '';
  const h = Math.floor((Date.now() - new Date(t).getTime()) / 3600000);
  if (h < 1) return 'in the last hour';
  if (h < 24) return h + ' hours ago';
  return Math.floor(h / 24) + ' days ago';
};

export default async function Jobs() {
  if (!pageAllowed(meSlug(), '/jobs')) return <NotYours what="Job health" />;

  let projects = [], activity = [], error = null;
  try {
    projects = await sanity(true).fetch(
      `*[_type=="project" && type=="social"]|order(name asc){slug,name,
        "calendars": count(calendarSources[current==true]),
        "lastCheck": *[_type=="weekReview" && projectSlug==^.slug && defined(qcAt)]|order(qcAt desc)[0].qcAt,
        "lastShip": *[_type=="weekReview" && projectSlug==^.slug && defined(shipGate.at)]|order(week desc)[0].shipGate.at}`);
    activity = await sanity(true).fetch('*[_type=="activity"]|order(at desc)[0...40]{_id,at,who,what,detail,target}');
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="eyebrow">System</div>
      <h1>Job health</h1>
      <p className="lede">
        Whether the machinery is actually running, and what it did last.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header><h2>Scheduled jobs</h2><span className="tag warn">none running</span></header>
        <div style={{ padding: '14px 16px', fontSize: 13.5, lineHeight: 1.6 }}>
          There are no scheduled jobs yet, and there cannot be while this runs on a laptop. Two are
          waiting to be switched on the day it is hosted: the morning digest, and the same day nudge
          when something dated is blocked. The digest time is already set in <Link href="/settings">Settings</Link>.
        </div>
      </div>

      <div className="panel">
        <header><h2>Calendars, and when they were last checked</h2></header>
        <table className="tbl">
          <thead><tr><th>Project</th><th style={{ width: 130 }}>Calendars linked</th><th style={{ width: 210 }}>Checks last run</th><th style={{ width: 210 }}>Last shipped</th><th style={{ width: 120 }} /></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.slug}>
                <td>{p.name}</td>
                <td>{p.calendars ? <span className="tag ok">{p.calendars}</span> : <span className="tag bad">none</span>}</td>
                <td>{p.lastCheck ? <>{when(p.lastCheck)}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{ago(p.lastCheck)}</div></> : <span className="tag mute">never</span>}</td>
                <td>{p.lastShip ? <>{when(p.lastShip)}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{ago(p.lastShip)}</div></> : <span className="tag mute">never</span>}</td>
                <td><Link className="btn sm" href={'/projects/' + p.slug + '/review'}>The week</Link></td>
              </tr>))}
            {projects.length === 0 ? <tr><td colSpan={5} className="empty">No social projects.</td></tr> : null}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          Whether Google is reachable at all is on <Link href="/setup">Connections</Link>, which tests every
          sheet and folder live.
        </div>
      </div>

      <div className="panel">
        <header><h2>Everything anyone did</h2><span className="pill">last {activity.length}</span></header>
        <table className="tbl">
          <thead><tr><th style={{ width: 140 }}>When</th><th style={{ width: 118 }}>Who</th><th style={{ width: 230 }}>What</th><th>Detail</th></tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a._id}>
                <td className="mono">{when(a.at)}</td>
                <td>{a.who}</td>
                <td>{a.what}</td>
                <td style={{ color: 'var(--muted)' }}>{a.detail || '—'}
                  {a.target ? <div className="mono" style={{ color: 'var(--faint)', fontSize: 11.5 }}>{a.target}</div> : null}</td>
              </tr>))}
            {activity.length === 0 ? <tr><td colSpan={4} className="empty">Nothing logged yet.</td></tr> : null}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          This log is written to, never edited. It is what the record of approvals is built from.
        </div>
      </div>
    </>
  );
}
