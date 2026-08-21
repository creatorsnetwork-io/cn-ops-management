'use client';
import { Fragment, useEffect, useState } from 'react';

const SCORE = { 1: ['landed first time', 'ok'], 2: ['needed a round', 'warn'], 3: ['had to be redone', 'bad'] };
const when = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function Vendors() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', kind: 'freelancer', skills: '', rate: '', contact: '', notes: '' });
  const [rate, setRate] = useState(null);
  const [rf, setRf] = useState({ score: 1, what: '', note: '' });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');

  function load() {
    fetch('/api/vendor').then((r) => r.json()).then((j) => (j.ok ? setD(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  }
  useEffect(load, []);

  async function post(body) {
    setBusy(body.action); setErr('');
    const r = await fetch('/api/vendor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setAdding(false); setRate(null); setRf({ score: 1, what: '', note: '' }); load(); } else setErr(j.error);
  }

  const items = (d && d.items) || [];
  const redoRate = (v) => {
    const jobs = v.jobs || [];
    if (!jobs.length) return null;
    return Math.round((jobs.filter((j) => j.score === 3).length / jobs.length) * 100);
  };

  return (
    <>
      {d && d.canEdit ? (
        adding ? (
          <div className="panel">
            <header><h2>Add someone</h2><button className="btn sm" onClick={() => setAdding(false)}>Cancel</button></header>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <label><div className="k">Name</div><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label><div className="k">What they are</div>
                <select className="inp" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                  <option value="freelancer">Freelancer</option><option value="vendor">Vendor or studio</option>
                </select></label>
              <label><div className="k">What they do</div><input className="inp" value={f.skills} placeholder="Editing, motion, DOP" onChange={(e) => setF({ ...f, skills: e.target.value })} /></label>
              <label><div className="k">What they cost</div><input className="inp" value={f.rate} placeholder="AED 1,200 a day" onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
              <label><div className="k">How to reach them</div><input className="inp" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}><div className="k">Notes</div><textarea className="inp" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
              <button className="btn dark" disabled={busy === 'add'} onClick={() => post({ action: 'add', ...f })}>Add them</button>
            </div>
          </div>
        ) : <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setAdding(true)}>Add someone</button></div>
      ) : null}

      <div className="panel">
        <header><h2>Who we use</h2><span className="pill">{items.filter((v) => v.active).length} active</span></header>
        {err ? <div style={{ padding: '11px 16px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
        {!d ? <div className="empty">Loading.</div> : null}
        {d ? (
          <table className="tbl">
            <thead><tr>
              <th>Who</th><th style={{ width: 160 }}>What they do</th><th style={{ width: 130 }}>Cost</th>
              <th style={{ width: 96 }}>Jobs</th><th style={{ width: 150 }}>Had to be redone</th><th style={{ width: 210 }} />
            </tr></thead>
            <tbody>
              {items.map((v) => {
                const rr = redoRate(v);
                return (
                  <Fragment key={v._id}>
                    <tr style={{ opacity: v.active ? 1 : 0.5 }}>
                      <td><b>{v.name}</b><div style={{ color: 'var(--faint)', fontSize: 12 }}>{v.kind === 'vendor' ? 'vendor' : 'freelancer'}{v.contact ? ' · ' + v.contact : ''}</div></td>
                      <td>{v.skills || '—'}</td>
                      <td>{v.rate || '—'}</td>
                      <td>{v.count || 0}</td>
                      <td>{rr == null ? <span className="tag mute">no history</span>
                        : <span className={'tag ' + (rr === 0 ? 'ok' : rr < 34 ? 'warn' : 'bad')}>{rr}%</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button className="btn sm" onClick={() => setOpen(open === v._id ? null : v._id)}>History</button>
                          {d.canRate ? <button className="btn sm dark" onClick={() => setRate(rate === v._id ? null : v._id)}>How did a job go</button> : null}
                          {d.canEdit ? <button className="btn link" disabled={busy === 'edit'} onClick={() => post({ action: 'edit', id: v._id, active: !v.active })}>{v.active ? 'Retire' : 'Bring back'}</button> : null}
                        </div>
                      </td>
                    </tr>
                    {rate === v._id ? (
                      <tr><td colSpan={6} style={{ background: '#FCFDFE' }}>
                        <div style={{ display: 'grid', gap: 9, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
                          <label><div className="k">How did it land</div>
                            <select className="inp" value={rf.score} onChange={(e) => setRf({ ...rf, score: +e.target.value })}>
                              <option value={1}>Landed first time</option>
                              <option value={2}>Needed a round</option>
                              <option value={3}>Had to be redone</option>
                            </select></label>
                          <label><div className="k">On what</div><input className="inp" value={rf.what} placeholder="The Amalfi film" onChange={(e) => setRf({ ...rf, what: e.target.value })} /></label>
                          <label style={{ gridColumn: '1 / -1' }}><div className="k">What happened{rf.score < 3 ? '' : ', required'}</div>
                            <input className="inp" value={rf.note} onChange={(e) => setRf({ ...rf, note: e.target.value })} /></label>
                        </div>
                        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                          <button className="btn dark" disabled={busy === 'rate'} onClick={() => post({ action: 'rate', id: v._id, ...rf })}>Record it</button>
                          <button className="btn" onClick={() => setRate(null)}>Cancel</button>
                        </div>
                      </td></tr>) : null}
                    {open === v._id ? (
                      <tr><td colSpan={6} style={{ background: '#FCFDFE' }}>
                        {(v.jobs || []).length === 0 ? <span style={{ fontSize: 13, color: 'var(--faint)' }}>No jobs recorded yet.</span> : null}
                        {(v.jobs || []).slice().reverse().map((j) => (
                          <div key={j._key} style={{ fontSize: 12.5, marginBottom: 5 }}>
                            <span className={'tag ' + SCORE[j.score][1]}>{SCORE[j.score][0]}</span>{' '}
                            {j.what ? <b>{j.what}</b> : null} {j.note}
                            <span style={{ color: 'var(--faint)' }}> · {j.by}, {when(j.at)}</span>
                          </div>))}
                        {v.notes ? <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--muted)' }}>Notes: {v.notes}</div> : null}
                      </td></tr>) : null}
                  </Fragment>);
              })}
              {items.length === 0 ? <tr><td colSpan={6} className="empty">Nobody recorded yet.</td></tr> : null}
            </tbody>
          </table>) : null}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          The only thing tracked per job is whether it landed, needed a round, or had to be redone.
          Rework is the cost that actually hurts, and it is the one nobody writes down.
        </div>
      </div>
    </>
  );
}
