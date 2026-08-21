'use client';
import { useState } from 'react';
import { MILESTONE_LABEL } from '../lib/cycles';

const TAGOF = { planned: 'mute', progress: 'info', delivered: 'warn', approved: 'ok' };
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const today = () => new Date().toISOString().slice(0, 10);

export default function Milestones({ slug, initial, canAdd }) {
  const [list, setList] = useState(initial || []);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', due: '', acceptance: '' });
  const [ask, setAsk] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function post(body) {
    setBusy(body.action + (body.key || '')); setErr('');
    const r = await fetch('/api/milestone', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, ...body }) });
    const j = await r.json(); setBusy('');
    if (j.ok) window.location.reload(); else setErr(j.error);
  }

  const late = list.filter((m) => m.due && m.due < today() && m.state !== 'approved').length;

  return (
    <div className="panel">
      <header>
        <h2>Milestones</h2>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {late ? <span className="tag bad">{late} past their date</span> : null}
          {canAdd ? <button className="btn sm dark" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add one'}</button> : null}
        </span>
      </header>

      {adding ? (
        <div style={{ padding: '14px 16px', display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', borderBottom: '1px solid var(--line2)' }}>
          <label style={{ gridColumn: '1 / -1' }}><div className="k">What lands</div>
            <input className="inp" value={f.name} placeholder="120 destination pages live on staging" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label><div className="k">By when</div><input className="inp" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}><div className="k">What counts as done</div>
            <input className="inp" value={f.acceptance} onChange={(e) => setF({ ...f, acceptance: e.target.value })} /></label>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn dark" disabled={busy === 'add'} onClick={() => post({ action: 'add', ...f })}>Add it</button>
          </div>
        </div>) : null}

      <table className="tbl">
        <thead><tr><th>What lands</th><th style={{ width: 96 }}>Due</th><th style={{ width: 140 }}>State</th><th>What counts as done</th><th style={{ width: 240 }} /></tr></thead>
        <tbody>
          {list.map((m) => (
            <tr key={m._key}>
              <td><b>{m.name}</b>
                {m.approvedBy ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>approved by {m.approvedBy}</div> : null}</td>
              <td className="mono" style={{ color: m.due && m.due < today() && m.state !== 'approved' ? 'var(--bad)' : undefined }}>{dayOf(m.due) || '—'}</td>
              <td><span className={'tag ' + TAGOF[m.state]}>{MILESTONE_LABEL[m.state]}</span></td>
              <td style={{ fontSize: 12.5 }}>{m.acceptance || <span style={{ color: 'var(--faint)' }}>not defined</span>}</td>
              <td>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {m.state === 'planned' ? <button className="btn sm" disabled={busy} onClick={() => post({ action: 'move', key: m._key, state: 'progress' })}>Start it</button> : null}
                  {m.state === 'progress' ? <button className="btn sm" disabled={busy} onClick={() => post({ action: 'move', key: m._key, state: 'delivered' })}>Delivered</button> : null}
                  {m.state === 'delivered' ? <button className="btn sm dark" onClick={() => setAsk(m._key)}>Client approved</button> : null}
                  {canAdd && m.state !== 'approved' ? <button className="btn link" onClick={() => post({ action: 'remove', key: m._key })}>Remove</button> : null}
                </div>
                {ask === m._key ? (
                  <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <input className="inp" style={{ width: 180 }} placeholder="Who at the client" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button className="btn sm dark" disabled={busy} onClick={() => post({ action: 'move', key: m._key, state: 'approved', clientName: note })}>Record it</button>
                    <button className="btn sm" onClick={() => { setAsk(null); setErr(''); }}>Cancel</button>
                  </div>) : null}
              </td>
            </tr>))}
          {list.length === 0 ? <tr><td colSpan={5} className="empty">
            No milestones yet. For a website or a campaign this is what a client actually judges you on.
          </td></tr> : null}
        </tbody>
      </table>
      {err ? <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        Delivered is your word. Client approved needs a person's name, because that is the one that counts.
      </div>
    </div>
  );
}
