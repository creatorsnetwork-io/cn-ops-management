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

  return (
    <>
    <div className="panel">
      <header><h2>Client week reviews</h2><span className="pill">{list.length}</span></header>
      <table className="tbl">
        <thead><tr>
          <th style={{ width: 168 }}>Project</th><th style={{ width: 92 }}>Week</th>
          <th style={{ width: 140 }}>Shared</th><th style={{ width: 168 }}>What they have done</th>
          <th>Link</th><th style={{ width: 190 }} />
        </tr></thead>
        <tbody>
          {list.map((r) => {
            const k = r.week + r.projectSlug;
            const answered = (r.approved || 0) + (r.changes || 0);
            return (
              <tr key={k}>
                <td>{r.projectName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{r.client}</div></td>
                <td className="mono">{dayOf(r.week)}</td>
                <td>{when(r.sharedAt)}</td>
                <td>
                  {r.approved ? <span className="tag ok" style={{ marginRight: 4 }}>{r.approved} approved</span> : null}
                  {r.changes ? <span className="tag bad" style={{ marginRight: 4 }}>{r.changes} changes</span> : null}
                  {!answered ? <span className="tag mute">not opened yet</span> : null}
                </td>
                <td className="mono" style={{ wordBreak: 'break-all', fontSize: 11.5 }}>/c/{r.clientToken}</td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => copy(r.clientToken)}>{copied === r.clientToken ? 'Copied' : 'Copy'}</button>
                    <a className="btn sm" href={'/c/' + r.clientToken} target="_blank" rel="noreferrer">Open</a>
                    <Link className="btn sm" href={'/projects/' + r.projectSlug + '/review?week=' + r.week}>The week</Link>
                    {canRevoke ? <button className="btn sm" disabled={busy === k} onClick={() => revoke(r)}>Revoke</button> : null}
                  </div>
                  {err[k] ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 4 }}>{err[k]}</div> : null}
                </td>
              </tr>);
          })}
          {list.length === 0 ? <tr><td colSpan={6} className="empty">
            No live links. One is created when a week's ship gate is signed and shared.
          </td></tr> : null}
        </tbody>
      </table>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        Anyone with a link can see that week and answer on it, with no login. Revoking kills the link
        immediately. Decisions already made are kept, they are the record.
      </div>
    </div>

    <div className="panel">
      <header><h2>Briefs and call sheets</h2><span className="pill">{sh.length}</span></header>
      <table className="tbl">
        <thead><tr>
          <th style={{ width: 130 }}>Kind</th><th>What</th><th style={{ width: 140 }}>Shared</th>
          <th style={{ width: 210 }}>What they did</th><th style={{ width: 180 }} />
        </tr></thead>
        <tbody>
          {sh.map((r) => (
            <tr key={r.token}>
              <td><span className={'tag ' + (r.kind === 'brief' ? 'info' : 'tl')}>{r.kind === 'brief' ? 'job brief' : 'call sheet'}</span></td>
              <td><Link href={'/work/' + r.workId}>{r.title}</Link>
                <div style={{ color: 'var(--faint)', fontSize: 12 }}>{r.client}, {r.projectName}</div></td>
              <td>{when(r.at)}<div style={{ color: 'var(--faint)', fontSize: 12 }}>by {r.by}</div></td>
              <td>{(r.responses || []).length
                ? (r.responses || []).map((x, i) => (
                    <div key={i} style={{ fontSize: 12.5 }}>
                      <span className={'tag ' + (x.kind === 'accepted' ? 'ok' : x.kind === 'declined' ? 'bad' : 'warn')}>{x.kind}</span> {x.by}
                    </div>))
                : <span className="tag mute">not opened yet</span>}</td>
              <td>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => copyShare(r.token)}>{copied === r.token ? 'Copied' : 'Copy'}</button>
                  <a className="btn sm" href={'/s/' + r.token} target="_blank" rel="noreferrer">Open</a>
                  {canRevoke ? <button className="btn sm" disabled={busy === r.token} onClick={() => revokeShare(r.token)}>Revoke</button> : null}
                </div>
                {err[r.token] ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 4 }}>{err[r.token]}</div> : null}
              </td>
            </tr>))}
          {sh.length === 0 ? <tr><td colSpan={5} className="empty">
            No briefs or call sheets are out. Both are made from a work item's own page.
          </td></tr> : null}
        </tbody>
      </table>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        Freelancers get no login by design. A brief link shows the job and nothing else about the portal,
        and anything they reply lands on the job rather than in somebody's messages.
      </div>
    </div>
    </>
  );
}
