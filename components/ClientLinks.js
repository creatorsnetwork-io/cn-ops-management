'use client';
import { useState } from 'react';
import Link from 'next/link';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

export default function ClientLinks({ rows, shares, canRevoke }) {
  const [list, setList] = useState(rows);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({});
  const [copied, setCopied] = useState('');

  async function revoke(r) {
    setBusy(r.week + r.projectSlug); setErr({});
    const res = await fetch('/api/review', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: r.projectSlug, week: r.week, action: 'revoke' }),
    });
    const j = await res.json(); setBusy('');
    if (j.ok) setList(list.filter((x) => !(x.week === r.week && x.projectSlug === r.projectSlug)));
    else setErr({ [r.week + r.projectSlug]: j.error });
  }

  function copy(t) {
    navigator.clipboard.writeText(window.location.origin + '/c/' + t);
    setCopied(t); setTimeout(() => setCopied(''), 1500);
  }

  const [sh, setSh] = useState(shares || []);
  async function revokeShare(t) {
    setBusy(t); setErr({});
    const res = await fetch('/api/share', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', token: t }),
    });
    const j = await res.json(); setBusy('');
    if (j.ok) setSh(sh.filter((x) => x.token !== t)); else setErr({ [t]: j.error });
  }
  function copyShare(t) {
    navigator.clipboard.writeText(window.location.origin + '/s/' + t);
    setCopied(t); setTimeout(() => setCopied(''), 1500);
  }

  const all = list.map((r) => ({
    id: 'client:' + r.clientToken,
    type: 'client', token: r.clientToken, client: r.client, project: r.projectName,
    what: 'Week of ' + dayOf(r.week), sent: r.sharedAt, by: r.by,
    url: '/c/' + r.clientToken, expiry: 'When the week closes', source: r,
    firstOpenedAt: r.firstOpenedAt, lastOpenedAt: r.lastOpenedAt,
    activity: (r.approved || 0) + (r.changes || 0)
      ? [r.approved ? r.approved + ' approved' : '', r.changes ? r.changes + ' changes' : ''].filter(Boolean).join(', ')
      : 'No decision yet',
  })).concat(sh.map((r) => ({
    id: 'share:' + r.token,
    type: 'share', token: r.token, client: r.client, project: r.projectName,
    what: (r.kind === 'brief' ? 'Job brief: ' : 'Call sheet: ') + r.title,
    sent: r.at, by: r.by, url: '/s/' + r.token, expiry: 'When the work closes', source: r,
    firstOpenedAt: r.firstOpenedAt, lastOpenedAt: r.lastOpenedAt,
    activity: (r.responses || []).length ? (r.responses || []).length + ' repl' + ((r.responses || []).length === 1 ? 'y' : 'ies') : 'No reply yet',
  })));

  return (
    <>
    <div className="panel">
      <table>
        <thead><tr>
          <th>Client</th><th>What</th><th>URL</th><th>Sent</th><th>By</th>
          <th>First opened</th><th>Last opened</th><th>Expiry</th><th>State</th><th />
        </tr></thead>
        <tbody>
          {all.map((r) => {
            const k = r.type === 'client' ? r.source.week + r.source.projectSlug : r.token;
            return (
              <tr key={r.id}>
                <td className="b">{r.client || 'Not recorded'}<div className="sub2">{r.project}</div></td>
                <td>{r.what}<div className="sub2">{r.activity}</div></td>
                <td className="dim" style={{ wordBreak: 'break-all', fontSize: 11.5 }}>{r.url}</td>
                <td className="dim">{when(r.sent) || 'Not recorded'}</td>
                <td className="dim">{r.by || 'Not recorded'}</td>
                <td className="dim">{r.firstOpenedAt ? when(r.firstOpenedAt) : 'Not opened yet'}</td>
                <td className="dim">{r.lastOpenedAt ? when(r.lastOpenedAt) : 'Not opened yet'}</td>
                <td className="dim">{r.expiry}</td>
                <td><span className="tag ok">Live</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => r.type === 'client' ? copy(r.token) : copyShare(r.token)}>{copied === r.token ? 'Copied' : 'Copy'}</button>
                    <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">Open</a>
                    {r.type === 'client' ? <Link className="btn sm" href={'/projects/' + r.source.projectSlug + '/review?week=' + r.source.week}>The week</Link> : <Link className="btn sm" href={'/work/' + r.source.workId}>The work</Link>}
                    {canRevoke ? <button className="btn sm" disabled={busy === k} onClick={() => r.type === 'client' ? revoke(r.source) : revokeShare(r.token)}>Revoke</button> : null}
                  </div>
                  {err[k] ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 4 }}>{err[k]}</div> : null}
                </td>
              </tr>);
          })}
          {all.length === 0 ? <tr><td colSpan={10} className="dim">
            No live links. Client links come from a shipped week; briefs and call sheets come from work.
          </td></tr> : null}
        </tbody>
      </table>
    </div>

    <div className="callout">
      <span><b>Open telemetry is first and last open only.</b> Every visit to the public link updates last opened; nothing per-visit is logged, and decisions or replies remain the real activity record.</span>
    </div>
    <p className="note">Links carry no commercial data. Revoking a link removes public access immediately while keeping decisions and replies in the operational record.</p>
    </>
  );
}
