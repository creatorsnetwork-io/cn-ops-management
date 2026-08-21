'use client';
import { useCallback, useEffect, useState } from 'react';

const monthKey = () => new Date().toISOString().slice(0, 7);
const monthName = () => new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function ProjectIdeas({ slug, clientDrive, canMark, initialDoc, initialLink }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr('');
    fetch('/api/cycle?slug=' + slug + '&month=' + monthKey())
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); else setErr(j.error); })
      .catch((e) => setErr(String(e)));
  }, [slug]);

  useEffect(load, [load]);

  async function mark(step, clear) {
    setBusy(step); setErr('');
    const r = await fetch('/api/cycle', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, month: monthKey(), action: 'mark', step, clear: !!clear }),
    }).then((x) => x.json());
    setBusy('');
    if (r.ok) load(); else setErr(r.error);
  }

  const cycle = data?.cycle || {};
  const doc = cycle.ideasDoc || initialDoc || '';
  const link = cycle.ideasLink || initialLink || '';
  const state = cycle.ideasApprovedAt ? 'Approved ' + when(cycle.ideasApprovedAt)
    : cycle.ideasSentAt ? 'With client since ' + when(cycle.ideasSentAt)
      : cycle.brainstormAt ? 'Brainstorm complete' : 'Not started';

  return (
    <div className="panel">
      <header>
        <div>
          <h2>Monthly ideas</h2>
          <div className="sub2">The team prepares the ideas in Drive, presents them, then records the client's approval here.</div>
        </div>
        <span className={'badge ' + (cycle.ideasApprovedAt ? 'ok' : '')}>{state}</span>
      </header>
      {!data && !err ? <div className="empty">Opening {monthName()}.</div> : null}
      {err ? <div className="pad" style={{ color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
      {data ? <>
        <table className="tbl"><tbody>
          <tr><td className="dim" style={{ width: 165 }}>Ideas doc</td><td className="b">
            {link ? <a href={link} target="_blank" rel="noreferrer">{doc || 'Open the ideas document'}</a> : (doc || 'Not linked')}
          </td></tr>
          <tr><td className="dim">Presented</td><td className="b">Monthly meeting</td></tr>
          <tr><td className="dim">Unlocks</td><td className="b">Plan week, and therefore generation</td></tr>
          <tr><td className="dim">Month</td><td className="b">{monthName()}</td></tr>
        </tbody></table>
        <div className="pad" style={{ borderTop: '1px solid var(--line2)' }}>
          <div className="rowb">
            {canMark && !cycle.brainstormAt ? <button className="btn" disabled={busy === 'brainstorm'} onClick={() => mark('brainstorm')}>Brainstorm held</button> : null}
            {canMark && cycle.brainstormAt && !cycle.ideasSentAt && !cycle.ideasApprovedAt
              ? <button className="btn" disabled={busy === 'ideasWith'} onClick={() => mark('ideasWith')}>Ideas sent</button> : null}
            {canMark && cycle.brainstormAt && !cycle.ideasApprovedAt
              ? <button className="btn dark" disabled={busy === 'ideas'} onClick={() => mark('ideas')}>Mark approved</button> : null}
            {canMark && cycle.ideasApprovedAt
              ? <button className="btn" disabled={busy === 'ideas'} onClick={() => mark('ideas', true)}>Reopen approval</button> : null}
            {link ? <a className="btn" href={link} target="_blank" rel="noreferrer">Open ideas doc</a>
              : clientDrive ? <a className="btn" href={'https://drive.google.com/drive/folders/' + clientDrive} target="_blank" rel="noreferrer">Open client Drive</a> : null}
          </div>
          {!link ? <p className="note" style={{ marginTop: 9 }}>The current data records ideas status but has no dedicated ideas document link. No new storage field is added here.</p> : null}
        </div>
      </> : null}
    </div>
  );
}
