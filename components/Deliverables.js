'use client';
import { useEffect, useState } from 'react';

const blank = () => ({ _key: 'new' + Math.floor(Math.random() * 1e9), name: '', target: 0, period: 'year', acceptance: '' });

export default function Deliverables({ slug, initial, canEdit }) {
  const [rows, setRows] = useState(initial || []);
  const [roll, setRoll] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/rollup?slug=' + slug).then((r) => r.json()).then((j) => j.ok && setRoll(j)).catch(() => {});
  }, [slug]);

  function set(i, k, v) { setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))); }

  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/project/' + slug, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deliverables: rows }),
    });
    const j = await r.json();
    setBusy(false);
    setMsg(j.ok ? 'Saved.' : (j.error || 'Could not save.'));
  }

  const t = roll ? roll.totals : null;

  return (
    <div className="panel">
      <header>
        <h2>Deliverables</h2>
        {canEdit ? <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => setRows([...rows, blank()])}>Add a line</button>
          <button className="btn sm dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save'}</button>
        </span> : <span className="pill">view only</span>}
      </header>

      {t ? (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
          <div className="stat">
            <div><b>{t.shipped}</b><span>submitted to client</span></div>
            <div><b style={{ color: 'var(--ok)' }}>{t.approved}</b><span>client approved</span></div>
            <div><b style={{ color: t.changes ? 'var(--bad)' : undefined }}>{t.changes}</b><span>changes asked</span></div>
            <div><b style={{ color: t.waiting ? 'var(--warn)' : undefined }}>{t.waiting}</b><span>no answer yet</span></div>
          </div>
          <p className="note" style={{ marginTop: 9 }}>
            Only client approvals count towards a target. The gap between submitted and answered is
            time sitting on the client's side, not ours, which is the number worth having in a renewal
            conversation.
          </p>
        </div>
      ) : null}

      <table className="tbl">
        <thead><tr>
          <th>What was promised</th><th style={{ width: 92 }}>Target</th><th style={{ width: 110 }}>Per</th>
          <th style={{ width: 130 }}>Approved so far</th><th>What counts as done</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._key || i}>
              <td><input className="inp" value={r.name} disabled={!canEdit} placeholder="Social posts" onChange={(e) => set(i, 'name', e.target.value)} /></td>
              <td><input className="inp" value={r.target} disabled={!canEdit} onChange={(e) => set(i, 'target', e.target.value)} /></td>
              <td>
                <select className="inp" value={r.period} disabled={!canEdit} onChange={(e) => set(i, 'period', e.target.value)}>
                  <option value="week">week</option><option value="month">month</option>
                  <option value="year">year</option><option value="total">contract</option>
                </select>
              </td>
              <td>{t ? <><b>{t.approved}</b>{r.target ? <span style={{ color: 'var(--faint)' }}> of {r.target}</span> : null}</> : '—'}</td>
              <td><input className="inp" value={r.acceptance} disabled={!canEdit} placeholder="Approved by the client in writing" onChange={(e) => set(i, 'acceptance', e.target.value)} /></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="empty">No baseline set. Add what the contract promised.</td></tr> : null}
        </tbody>
      </table>
      {msg ? <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div> : null}

      {roll && roll.rows.length ? (
        <>
          <div style={{ padding: '13px 16px', borderTop: '1px solid var(--line)', fontWeight: 600, fontSize: 13.5 }}>Week by week</div>
          <table className="tbl">
            <thead><tr><th>Week</th><th>Submitted</th><th>Approved</th><th>Changes</th><th>Craft gate</th><th>Ship gate</th><th /></tr></thead>
            <tbody>
              {roll.rows.slice().reverse().map((w) => (
                <tr key={w.week}>
                  <td className="mono">{w.week}</td>
                  <td>{w.shipped || '—'}</td>
                  <td>{w.approved ? <span className="tag ok">{w.approved}</span> : '—'}</td>
                  <td>{w.changes ? <span className="tag bad">{w.changes}</span> : '—'}</td>
                  <td>{w.craftBy || <span className="tag mute">open</span>}</td>
                  <td>{w.shipBy ? <>{w.shipBy}{w.override ? <span className="tag warn" style={{ marginLeft: 5 }}>override</span> : null}</> : <span className="tag mute">open</span>}</td>
                  <td><a className="btn sm" href={'/projects/' + slug + '/review?week=' + w.week}>Open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
