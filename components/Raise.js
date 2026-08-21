'use client';
import { useState } from 'react';

// "I need a decision." Always goes to the raiser's lead first.
export default function Raise({ leadName, workId, projectSlug, label, context }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  async function send() {
    setBusy(true); setErr('');
    const r = await fetch('/api/escalation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'raise', reason, detail, workId, slug: projectSlug }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setDone(j.wentTo); setOpen(false); setReason(''); setDetail(''); }
    else setErr(j.error);
  }

  if (done) return (
    <div className="guard" style={{ marginTop: 14 }}>
      Sent to {leadName || done}. It is on their home screen now. If they cannot decide it, they pass it
      up and that gets recorded.
    </div>);

  if (!open) return (
    <button className="btn" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
      {label || 'I need a decision on this'}
    </button>);

  return (
    <div className="panel">
      <header>
        <h2>What do you need decided</h2>
        <span className="pill">goes to {leadName || 'your lead'}</span>
      </header>
      <div style={{ padding: '14px 16px', display: 'grid', gap: 11 }}>
        {context ? <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>About: {context}</div> : null}
        <label><div className="k">The decision, in one line</div>
          <input className="inp" value={reason} placeholder="Whether to reshoot or ship the version we have"
            onChange={(e) => setReason(e.target.value)} /></label>
        <label><div className="k">What they need to know to decide it</div>
          <textarea className="inp" value={detail} onChange={(e) => setDetail(e.target.value)} /></label>
      </div>
      {err ? <div style={{ padding: '0 16px 12px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)', display: 'flex', gap: 7 }}>
        <button className="btn dark" disabled={busy} onClick={send}>{busy ? 'Sending' : 'Send it to ' + (leadName || 'my lead')}</button>
        <button className="btn" onClick={() => { setOpen(false); setErr(''); }}>Cancel</button>
      </div>
      <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        This never goes straight to Himanshu. It goes to the person you report to, and only reaches him
        if they say they cannot decide it.
      </div>
    </div>
  );
}
