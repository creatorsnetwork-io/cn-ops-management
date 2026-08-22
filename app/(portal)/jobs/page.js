import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import JobCards from '../../../components/JobCards';

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

  let projects = [], activity = [], settings = null, error = null;
  try {
    [projects, activity, settings] = await Promise.all([
      sanity(true).fetch(
        `*[_type=="project" && type=="social"]|order(name asc){
        "calendars": count(calendarSources[current==true]),
        "lastCheck": *[_type=="weekReview" && projectSlug==^.slug && defined(qcAt)]|order(qcAt desc)[0].qcAt,
        "lastShip": *[_type=="weekReview" && projectSlug==^.slug && defined(shipGate.at)]|order(week desc)[0].shipGate.at}`),
      sanity(true).fetch('*[_type=="activity"]|order(at desc)[0...40]{_id,at,who,what,detail,target}'),
      sanity(true).fetch('*[_id=="settings.house"][0]{digestHour}'),
    ]);
  } catch (e) { error = e.message; }

  const latest = (field) => projects.map((p) => p[field]).filter(Boolean).sort().slice(-1)[0] || null;
  const missingCalendars = projects.filter((p) => !p.calendars).length;
  const digestHour = settings?.digestHour != null ? settings.digestHour : 8;
  const cards = [
    {
      id: 'calendar', name: 'Calendar reader', schedule: 'Manual and page load',
      status: missingCalendars ? 'Needs attention' : 'Ready', last: latest('lastCheck'), next: 'Run on demand',
      result: missingCalendars ? missingCalendars + ' social project(s) have no current calendar' : projects.length + ' social project(s) configured',
      endpoint: '/api/week',
    },
    {
      id: 'connections', name: 'Connections health check', schedule: 'Manual', status: 'Ready',
      last: null, next: 'Run on demand', result: 'Sanity, Sheets, Drive and model keys', endpoint: '/api/health',
    },
    {
      id: 'rollup', name: 'Approval rollup', schedule: 'On demand', status: 'Ready',
      last: latest('lastShip'), next: 'Run on demand', result: 'Reads shipped weeks and client decisions', endpoint: '/api/rollup',
    },
    {
      id: 'qc', name: 'Quality checks', schedule: 'From each week review', status: latest('lastCheck') ? 'Healthy' : 'Waiting',
      last: latest('lastCheck'), next: 'From the week review', result: latest('lastCheck') ? 'Last result is recorded' : 'No recorded run', endpoint: null,
    },
    {
      id: 'digest', name: 'Morning digest', schedule: String(digestHour).padStart(2, '0') + ':00 GST', status: 'Scheduled',
      last: null, next: 'After hosting is connected', result: 'No scheduled runner yet', endpoint: null,
    },
    {
      id: 'nudge', name: 'Same-day blocked nudge', schedule: 'Same day', status: 'Scheduled',
      last: null, next: 'After hosting is connected', result: 'No scheduled runner yet', endpoint: null,
    },
  ];
  const digests = activity.filter((a) => String(a.what || '').toLowerCase().includes('digest'));

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Monitoring and recovery</div>
          <h1>Job health</h1>
          <p className="lede">Each job shows its last evidence, next run, result and manual recovery path.</p>
        </div>
        <div className="rowb">
          <button className="btn" disabled title="No failure-alert endpoint exists yet">Test failure alert</button>
          <a className="btn dark" href="/jobs">Refresh</a>
        </div>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="alertbar">
        <span><b>No daily heartbeat is being written yet.</b> Manual reads can run now, while the digest and same-day nudge remain waiting for hosted scheduling.</span>
        <Link className="btn sm" href="/setup">Check connections</Link>
      </div>

      <JobCards cards={cards} />

      <div className="panel">
        <header><h2>Digest history</h2><span className="hint">the push channel once scheduling is connected</span></header>
        {digests.map((d) => <div key={d._id} style={{ padding: '13px 15px', borderBottom: '1px solid var(--line2)', fontSize: 13 }}><div className="lbl">{when(d.at)}</div><div style={{ marginTop: 4 }}>{d.detail || d.what}</div></div>)}
        {digests.length === 0 ? <div className="pad note">No digest run has been recorded.</div> : null}
      </div>

      <div className="panel">
        <header><h2>Everything anyone did</h2><span className="pill">last {activity.length}</span></header>
        <table>
          <thead><tr><th style={{ width: 140 }}>When</th><th style={{ width: 118 }}>Who</th><th style={{ width: 230 }}>What</th><th>Detail</th></tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a._id}>
                <td className="dim">{when(a.at)}</td>
                <td>{a.who}</td>
                <td>{a.what}</td>
                <td style={{ color: 'var(--muted)' }}>{a.detail || 'No detail'}
                  {a.target ? <div className="dim" style={{ color: 'var(--faint)', fontSize: 11.5 }}>{a.target}</div> : null}</td>
              </tr>))}
            {activity.length === 0 ? <tr><td colSpan={4} className="dim">Nothing logged yet.</td></tr> : null}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          This log is written to, never edited. It is what the record of approvals is built from.
        </div>
      </div>
    </>
  );
}
