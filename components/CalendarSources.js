'use client';
import { useState } from 'react';

const blank = () => ({ _key: 'new' + Math.floor(Math.random() * 1e9), label: '', sheetId: '', year: new Date().getFullYear(), current: true });

export default function CalendarSources({ slug, initial, canEdit }) {
  const [rows, setRows] = useState(initial && initial.length ? initial : []);
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');

  function set(i, k, v) { setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))); }
  function del(i) { setRows(rows.filter((_, j) => j !== i)); }

  async function save() {
    setState('saving'); setMsg('');
    const res = await fetch('/api/project/' + slug, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ calendarSources: rows }),
    });
    const j = await res.json();
    if (j.ok) { setState('idle'); setMsg('Saved.'); }
    else { setState('idle'); setMsg(j.error || 'Could not save.'); }
  }

  return (
    <div className="panel">
      <header>
        <h2>Calendar links</h2>
        {canEdit ? <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => setRows([...rows, blank()])}>Add a calendar</button>
          <button className="btn sm dark" onClick={save} disabled={state === 'saving'}>{state === 'saving' ? 'Saving' : 'Save'}</button>
        </span> : <span className="pill">view only</span>}
      </header>

      <table className="tbl">
        <thead><tr><th style={{ width: '26%' }}>Name</th><th>Sheet link or ID</th><th style={{ width: 90 }}>Year</th><th style={{ width: 90 }}>In use</th><th style={{ width: 60 }} /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._key || i}>
              <td><input className="inp" value={r.label} disabled={!canEdit} placeholder="2026 calendar" onChange={(e) => set(i, 'label', e.target.value)} /></td>
              <td>
                <input className="inp mono" value={r.sheetId} disabled={!canEdit} placeholder="paste the full Google Sheets link" onChange={(e) => set(i, 'sheetId', e.target.value)} />
                {r.sheetId && !r.sheetId.includes('/')
                  ? <a style={{ fontSize: 12 }} target="_blank" rel="noreferrer" href={'https://docs.google.com/spreadsheets/d/' + r.sheetId}>open sheet</a>
                  : null}
              </td>
              <td><input className="inp" value={r.year} disabled={!canEdit} onChange={(e) => set(i, 'year', e.target.value)} /></td>
              <td><input type="checkbox" checked={!!r.current} disabled={!canEdit} onChange={(e) => set(i, 'current', e.target.checked)} /></td>
              <td>{canEdit ? <button className="btn link" onClick={() => del(i)}>Remove</button> : null}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="empty">No calendar linked to this project yet.</td></tr> : null}
        </tbody>
      </table>
      {msg ? <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div> : null}
      <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        Paste the whole address from the browser, the ID is picked out automatically. Untick “in use” to
        keep an old year for history without it counting towards this week.
      </div>
    </div>
  );
}
