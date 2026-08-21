'use client';
import { useState } from 'react';

export default function ShareWork({ item, canShare }) {
  const [tokens, setTokens] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [cs, setCs] = useState(item.callSheet || { date: '', callTime: '', wrapTime: '', location: '', mapLink: '', contacts: [], schedule: [], kit: '', notes: '' });
  const [copied, setCopied] = useState('');

  if (!canShare) return null;

  async function make(kind) {
    setBusy(kind); setErr('');
    const r = await fetch('/api/share', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', kind, workId: item._id }),
    });
    const j = await r.json(); setBusy('');
    if (j.ok) setTokens({ ...tokens, [kind]: j.token }); else setErr(j.error);
  }

  async function saveCs() {
    setBusy('cs'); setErr('');
    const r = await fetch('/api/share', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'callsheet', workId: item._id, callSheet: cs }),
    });
    const j = await r.json(); setBusy('');
    if (!j.ok) setErr(j.error); else setErr('');
  }

  function copy(kind) {
    const url = window.location.origin + '/s/' + tokens[kind];
    navigator.clipboard.writeText(url);
    setCopied(kind); setTimeout(() => setCopied(''), 1500);
  }

  const row = (kind, label, help) => (
    <div className="row">
      <span className={'dot ' + (tokens[kind] ? 'ok' : 'no')} />
      <div className="t"><b>{label}</b><span>{help}</span>
        {tokens[kind] ? <span className="mono" style={{ fontSize: 11.5 }}>/s/{tokens[kind]}</span> : null}</div>
      <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {tokens[kind] ? <>
          <button className="btn sm" onClick={() => copy(kind)}>{copied === kind ? 'Copied' : 'Copy link'}</button>
          <a className="btn sm" href={'/s/' + tokens[kind]} target="_blank" rel="noreferrer">Open it</a>
        </> : <button className="btn sm dark" disabled={busy === kind} onClick={() => make(kind)}>{busy === kind ? 'Making' : 'Make a link'}</button>}
      </span>
    </div>);

  return (
    <div className="panel">
      <header>
        <h2>Send it outside the team</h2>
        <button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Hide the call sheet' : 'Fill in the call sheet'}</button>
      </header>

      {row('brief', 'Job brief for a freelancer', 'The brief, what counts as done, and the Drive folder. They can take it, ask a question, or turn it down, all without a login.')}
      {row('callsheet', 'Call sheet for a shoot', 'Date, call time, where, who to call, running order. Needs filling in first.')}

      {err ? <div style={{ padding: '11px 16px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}

      {open ? (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)', display: 'grid', gap: 11 }}>
          <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <label><div className="k">Date</div><input className="inp" type="date" value={cs.date || ''} onChange={(e) => setCs({ ...cs, date: e.target.value })} /></label>
            <label><div className="k">Call time</div><input className="inp" value={cs.callTime || ''} placeholder="07:00" onChange={(e) => setCs({ ...cs, callTime: e.target.value })} /></label>
            <label><div className="k">Wrap</div><input className="inp" value={cs.wrapTime || ''} placeholder="18:00" onChange={(e) => setCs({ ...cs, wrapTime: e.target.value })} /></label>
          </div>
          <label><div className="k">Where</div><input className="inp" value={cs.location || ''} onChange={(e) => setCs({ ...cs, location: e.target.value })} /></label>
          <label><div className="k">Map link</div><input className="inp mono" value={cs.mapLink || ''} onChange={(e) => setCs({ ...cs, mapLink: e.target.value })} /></label>

          <div>
            <div className="k" style={{ marginBottom: 5 }}>Who to call</div>
            {(cs.contacts || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <input className="inp" style={{ flex: 1, minWidth: 120 }} placeholder="Name" value={c.name} onChange={(e) => setCs({ ...cs, contacts: cs.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className="inp" style={{ flex: 1, minWidth: 110 }} placeholder="Role" value={c.role} onChange={(e) => setCs({ ...cs, contacts: cs.contacts.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} />
                <input className="inp" style={{ flex: 1, minWidth: 110 }} placeholder="Phone" value={c.phone} onChange={(e) => setCs({ ...cs, contacts: cs.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })} />
                <button className="btn link" onClick={() => setCs({ ...cs, contacts: cs.contacts.filter((_, j) => j !== i) })}>Drop</button>
              </div>))}
            <button className="btn sm" onClick={() => setCs({ ...cs, contacts: (cs.contacts || []).concat([{ name: '', role: '', phone: '' }]) })}>Add a contact</button>
          </div>

          <div>
            <div className="k" style={{ marginBottom: 5 }}>Running order</div>
            {(cs.schedule || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <input className="inp" style={{ width: 100 }} placeholder="09:00" value={s.time} onChange={(e) => setCs({ ...cs, schedule: cs.schedule.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
                <input className="inp" style={{ flex: 1, minWidth: 200 }} placeholder="What happens" value={s.what} onChange={(e) => setCs({ ...cs, schedule: cs.schedule.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)) })} />
                <button className="btn link" onClick={() => setCs({ ...cs, schedule: cs.schedule.filter((_, j) => j !== i) })}>Drop</button>
              </div>))}
            <button className="btn sm" onClick={() => setCs({ ...cs, schedule: (cs.schedule || []).concat([{ time: '', what: '' }]) })}>Add a line</button>
          </div>

          <label><div className="k">Kit</div><textarea className="inp" value={cs.kit || ''} onChange={(e) => setCs({ ...cs, kit: e.target.value })} /></label>
          <label><div className="k">Anything else</div><textarea className="inp" value={cs.notes || ''} onChange={(e) => setCs({ ...cs, notes: e.target.value })} /></label>
          <div><button className="btn dark" disabled={busy === 'cs'} onClick={saveCs}>{busy === 'cs' ? 'Saving' : 'Save the call sheet'}</button></div>
        </div>) : null}
    </div>
  );
}
