'use client';
import { useState } from 'react';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function Contract({ slug, contract, canUpload }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [proposal, setProposal] = useState(null);
  const [unclear, setUnclear] = useState([]);
  const [file, setFile] = useState(null);

  async function upload() {
    if (!file) { setErr('Pick a file first.'); return; }
    setBusy('up'); setErr(''); setMsg('');
    const fd = new FormData();
    fd.append('slug', slug); fd.append('file', file);
    const r = await fetch('/api/contract', { method: 'POST', body: fd });
    const j = await r.json(); setBusy('');
    if (j.ok) { setMsg('Read ' + j.characters.toLocaleString() + ' characters out of ' + j.filename + '.'); setTimeout(() => window.location.reload(), 900); }
    else setErr(j.error);
  }

  async function extract() {
    setBusy('ex'); setErr(''); setMsg('');
    const r = await fetch('/api/contract', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'extract', slug }),
    });
    const j = await r.json(); setBusy('');
    if (j.ok) { setProposal(j.deliverables); setUnclear(j.unclear || []); }
    else setErr(j.error);
  }

  async function apply() {
    setBusy('ap'); setErr('');
    const r = await fetch('/api/contract', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'apply', slug, deliverables: proposal }),
    });
    const j = await r.json(); setBusy('');
    if (j.ok) { setMsg('Baseline set to ' + j.count + ' line(s).'); setProposal(null); setTimeout(() => window.location.reload(), 900); }
    else setErr(j.error);
  }

  function edit(i, k, v) { setProposal(proposal.map((d, j) => (j === i ? { ...d, [k]: v } : d))); }

  return (
    <div className="panel">
      <header>
        <h2>The contract</h2>
        {contract ? <span className="pill">{contract.filename}</span> : <span className="tag warn">none uploaded</span>}
      </header>

      <div style={{ padding: '14px 16px' }}>
        {contract ? (
          <p style={{ fontSize: 13 }}>
            Uploaded by {contract.by} on {when(contract.at)}, read as {contract.read},
            {' '}{(contract.characters || 0).toLocaleString()} characters of text.
          </p>) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Upload the signed agreement and the deliverable lines can be read out of it rather than typed.
            PDF, .docx, or plain text. Scans will not work, the text has to be selectable.
          </p>)}

        {canUpload ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={(e) => setFile(e.target.files[0])} style={{ fontSize: 13 }} />
            <button className="btn sm dark" disabled={busy === 'up'} onClick={upload}>{busy === 'up' ? 'Reading' : contract ? 'Replace it' : 'Upload it'}</button>
            {contract ? <button className="btn sm" disabled={busy === 'ex'} onClick={extract}>{busy === 'ex' ? 'Reading' : '✦ Read the deliverables out of it'}</button> : null}
            {contract ? <button className="btn sm" onClick={async () => {
              setBusy('rm'); setErr(''); setMsg('');
              const r = await fetch('/api/contract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', slug }) }).then((x) => x.json());
              setBusy('');
              if (r.ok) { setMsg('Removed. The deliverable baseline was left as it is.'); setTimeout(() => window.location.reload(), 900); } else setErr(r.error);
            }}>Remove it</button> : null}
          </div>) : <span className="pill" style={{ marginTop: 10, display: 'inline-block' }}>view only</span>}

        {msg ? <div style={{ marginTop: 9, fontSize: 13, color: 'var(--ok)' }}>{msg}</div> : null}
        {err ? <div style={{ marginTop: 9, fontSize: 13, color: 'var(--bad)' }}>{err}</div> : null}
      </div>

      {proposal ? (
        <>
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line)', fontWeight: 600, fontSize: 13.5 }}>
            What the contract says, as read. Nothing is saved until you accept it.
          </div>
          <table className="tbl">
            <thead><tr><th>Line</th><th style={{ width: 92 }}>Target</th><th style={{ width: 110 }}>Per</th><th>What counts as done</th><th style={{ width: 60 }} /></tr></thead>
            <tbody>
              {proposal.map((d, i) => (
                <tr key={i}>
                  <td><input className="inp" value={d.name} onChange={(e) => edit(i, 'name', e.target.value)} /></td>
                  <td><input className="inp" value={d.target} onChange={(e) => edit(i, 'target', e.target.value)} /></td>
                  <td>
                    <select className="inp" value={d.period} onChange={(e) => edit(i, 'period', e.target.value)}>
                      <option value="week">week</option><option value="month">month</option>
                      <option value="year">year</option><option value="total">contract</option>
                    </select></td>
                  <td><input className="inp" value={d.acceptance} onChange={(e) => edit(i, 'acceptance', e.target.value)} /></td>
                  <td><button className="btn link" onClick={() => setProposal(proposal.filter((_, j) => j !== i))}>Drop</button></td>
                </tr>))}
              {proposal.length === 0 ? <tr><td colSpan={5} className="empty">Nothing definite enough to propose.</td></tr> : null}
            </tbody>
          </table>
          {unclear.length ? (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
              <div className="k">Could not be pinned down, decide these yourself</div>
              {unclear.map((u, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 3 }}>{u}</div>)}
            </div>) : null}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)', display: 'flex', gap: 7 }}>
            <button className="btn dark" disabled={busy === 'ap' || !proposal.length} onClick={apply}>Accept as the baseline</button>
            <button className="btn" onClick={() => setProposal(null)}>Throw it away</button>
          </div>
        </>) : null}
    </div>
  );
}
