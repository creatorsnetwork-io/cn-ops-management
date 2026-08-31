'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { thisMonth, monthLabel, shiftMonth } from '../lib/cycles';
import { LABEL, TAG } from '../lib/work';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function MonthCycle({ slug }) {
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [ackBy, setAckBy] = useState('');

  const load = useCallback(() => {
    setD(null); setErr('');
    fetch('/api/cycle?slug=' + slug + '&month=' + month).then((r) => r.json()).then((j) => {
      if (!j.ok) { setErr(j.error); return; }
      setD(j); setLink((j.cycle && j.cycle.reportLink) || ''); setNotes((j.cycle && j.cycle.notes) || '');
    }).catch((e) => setErr(String(e)));
  }, [slug, month]);
  useEffect(load, [load]);

  async function post(body) {
    setBusy(body.action); setErr('');
    const r = await fetch('/api/cycle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, month, ...body }) });
    const j = await r.json(); setBusy('');
    if (j.ok) load(); else setErr(j.error);
  }

  const cy = (d && d.cycle) || {};
  const shipped = !!cy.shipGate;

  return (
    <div className="panel">
      <header>
        <h2>{monthLabel(month)}</h2>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))}>Previous</button>
          <button className="btn sm" onClick={() => setMonth(thisMonth())}>This month</button>
          <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))}>Next</button>
        </span>
      </header>

      {!d && !err ? <div className="empty">Loading.</div> : null}
      {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not open this month</b><span className="err">{err}</span></div></div> : null}

      {d ? (
        <>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
            <div className="stat">
              <div><b>{d.work.length}</b><span>pieces of work</span></div>
              <div><b style={{ color: 'var(--ok)' }}>{d.done}</b><span>client approved</span></div>
              <div><b className={shipped ? '' : ''} style={{ color: shipped ? 'var(--ok)' : 'var(--warn)' }}>{shipped ? 'yes' : 'no'}</b><span>signed off</span></div>
            </div>
          </div>

          <div style={{ padding: '14px 16px', display: 'grid', gap: 11 }}>
            <label><div className="k">The report for this month</div>
              <input className="inp mono" value={link} placeholder="Paste the Google Doc or Sheet link"
                onChange={(e) => setLink(e.target.value)} /></label>
            <label><div className="k">Anything worth recording</div>
              <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button className="btn sm" disabled={busy === 'save'} onClick={() => post({ action: 'save', reportLink: link, notes })}>Save</button>
              {!shipped && d.perms.canShip
                ? <button className="btn sm dark" disabled={busy === 'ship'} onClick={() => post({ action: 'ship' })}>Sign the month off</button> : null}
              {shipped && d.perms.canShip
                ? <button className="btn sm" disabled={busy === 'reopen'} onClick={() => post({ action: 'reopen' })}>Reopen it</button> : null}
              {cy.reportLink ? <a className="btn sm" target="_blank" rel="noreferrer" href={cy.reportLink}>Open the report</a> : null}
            </div>
          </div>

          <div className="row">
            <span className={'dot ' + (cy.reportLink ? 'ok' : 'no')} />
            <div className="t"><b>Report linked</b>
              <span>{cy.reportLink ? (cy.reportLinkBy ? 'Added by ' + cy.reportLinkBy + ' on ' + when(cy.reportLinkAt) : 'Link saved') : 'Not linked yet'}</span></div>
          </div>
          <div className="row">
            <span className={'dot ' + (shipped ? 'ok' : 'no')} />
            <div className="t"><b>Signed off</b>
              <span>{shipped ? 'By ' + cy.shipGate.by + ' on ' + when(cy.shipGate.at)
                : cy.reportLink ? 'Ready to sign' : 'No report linked yet, so it cannot be signed'}</span></div>
          </div>
          <div className="row">
            <span className={'dot ' + (cy.clientAck ? 'ok' : 'no')} />
            <div className="t"><b>Client acknowledged</b>
              <span>{cy.clientAck ? cy.clientAck.by + ' on ' + when(cy.clientAck.at) : 'Not recorded'}</span></div>
            {!cy.clientAck && shipped ? (
              <span style={{ display: 'flex', gap: 5 }}>
                <input className="inp" style={{ width: 170 }} placeholder="Who acknowledged it" value={ackBy} onChange={(e) => setAckBy(e.target.value)} />
                <button className="btn sm" disabled={busy === 'ack'} onClick={() => post({ action: 'ack', by: ackBy })}>Record it</button>
              </span>) : null}
          </div>

          <table className="tbl">
            <thead><tr><th>Work dated or approved in this month</th><th style={{ width: 118 }}>Who</th><th style={{ width: 92 }}>Due</th><th style={{ width: 128 }}>State</th></tr></thead>
            <tbody>
              {d.work.map((w) => (
                <tr key={w._id}>
                  <td><Link href={'/work/' + w._id}>{w.title}</Link></td>
                  <td>{w.assigneeName || '—'}</td>
                  <td className="mono">{w.due || '—'}</td>
                  <td><span className={'tag ' + (TAG[w.state] || 'mute')}>{LABEL[w.state]}</span></td>
                </tr>))}
              {d.work.length === 0 ? <tr><td colSpan={4} className="empty">Nothing dated in this month yet.</td></tr> : null}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            A month cannot be signed off without a report linked, because a month with nothing to show
            for it is not finished, it is just over.
          </div>
        </>) : null}
    </div>
  );
}
