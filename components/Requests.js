'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KINDS, LABEL } from '../lib/work';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const CHAN = { whatsapp: 'WhatsApp', email: 'Email', call: 'Call', meeting: 'Meeting' };
const SCOPE = { yes: ['in scope', 'ok'], no: ['out of scope', 'bad'], unclear: ['scope unclear', 'warn'] };

function LogForm({ clients, projects, onDone, onCancel }) {
  const [f, setF] = useState({ clientSlug: clients[0]?.slug || '', projectSlug: '', from: '', channel: 'whatsapp', what: '', due: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const forClient = projects.filter((p) => p.clientSlug === f.clientSlug);

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'log', ...f }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) onDone(); else setErr(j.error);
  }

  // Chips rather than dropdowns. This gets filled in on a phone, in a meeting,
  // with one thumb, so every choice should be one tap and nothing should need
  // scrolling inside a select.
  const chips = (label, value, options, onPick) => (
    <div>
      <div className="lbl">{label}</div>
      <div className="mchips" style={{ marginTop: 5 }}>
        {options.map(([v, l]) => (
          <button key={v} type="button" className={'mchip' + (value === v ? ' on' : '')} onClick={() => onPick(v)}>{l}</button>))}
      </div>
    </div>);

  return (
    <div className="panel">
      <header><h2>Log what they asked for</h2><button className="btn sm" onClick={onCancel}>Cancel</button></header>
      <div className="pad" style={{ display: 'grid', gap: 13 }}>
        {chips('Client', f.clientSlug, clients.map((c) => [c.slug, c.name]), (v) => setF((p) => ({ ...p, clientSlug: v, projectSlug: '' })))}
        {chips('How they asked', f.channel, Object.keys(CHAN).map((k) => [k, CHAN[k]]), (v) => set('channel', v))}
        {forClient.length
          ? chips('Against which project', f.projectSlug, [['', 'Not sure yet']].concat(forClient.map((p) => [p.slug, p.name])), (v) => set('projectSlug', v))
          : null}
        <label><div className="lbl">What they asked for, in their words</div>
          <textarea className="inp" style={{ minHeight: 90 }} value={f.what} onChange={(e) => set('what', e.target.value)} /></label>
        <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <label><div className="lbl">Who asked</div><input className="inp" value={f.from} placeholder="Name at the client" onChange={(e) => set('from', e.target.value)} /></label>
          <label><div className="lbl">When they want it</div><input className="inp" type="date" value={f.due} onChange={(e) => set('due', e.target.value)} /></label>
        </div>
      </div>
      {err ? <div className="pad" style={{ paddingTop: 0, color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
      <div style={{ padding: '12px 15px', borderTop: '1px solid var(--line2)' }}>
        <button className="btn dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Log it'}</button>
        <span style={{ marginLeft: 10, fontSize: 12.5, color: 'var(--faint)' }}>
          Client and what they said are the only two that matter. The rest can wait.
        </span>
      </div>
    </div>);
}

function Row({ r, projects, people, canTriage, reload }) {
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [pick, setPick] = useState({ projectSlug: r.projectSlug || '', kind: 'other', assignee: '', title: r.what ? r.what.slice(0, 80) : '', due: r.due || '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const sc = SCOPE[r.inScope] || SCOPE.unclear;
  const forClient = projects.filter((p) => p.clientSlug === r.clientSlug);

  async function send(action, extra) {
    setBusy(true); setErr('');
    const res = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, id: r._id, note, ...(extra || {}) }) });
    const j = await res.json(); setBusy(false);
    if (j.ok) { setMode(null); setNote(''); reload(); } else setErr(j.error);
  }

  return (
    <>
      <tr>
        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{when(r.at)}
          <div style={{ color: 'var(--faint)', fontSize: 12 }}>{CHAN[r.channel]}</div></td>
        <td>{r.clientName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{r.from || 'unnamed'}</div></td>
        <td style={{ whiteSpace: 'pre-wrap' }}>{r.what}
          {r.decision ? <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 5 }}>Decision: {r.decision}</div> : null}</td>
        <td><span className={'tag ' + sc[1]}>{sc[0]}</span></td>
        <td>
          <span className={'tag ' + (r.state === 'accepted' ? 'ok' : r.state === 'declined' ? 'bad' : r.state === 'parked' ? 'warn' : 'mute')}>{r.state}</span>
          {r.workId ? <div style={{ marginTop: 4 }}><Link href={'/work/' + r.workId} style={{ fontSize: 12.5 }}>{LABEL[r.workState] || 'open'}: {r.workTitle}</Link></div> : null}
        </td>
        <td>
          {canTriage ? (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {r.state === 'new' ? <>
                {r.inScope !== 'yes' ? <button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'yes' })}>In scope</button> : null}
                {r.inScope !== 'no' ? <button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'no' })}>Out of scope</button> : null}
                <button className="btn sm dark" onClick={() => setMode('accept')}>Turn into work</button>
                <button className="btn sm" onClick={() => setMode('decline')}>Decline</button>
                <button className="btn sm" onClick={() => setMode('park')}>Park</button>
              </> : <button className="btn sm" disabled={busy} onClick={() => send('reopen')}>Reopen</button>}
            </div>) : <span className="pill">view only</span>}
        </td>
      </tr>
      {mode ? (
        <tr><td colSpan={6} style={{ background: '#FCFDFE' }}>
          {mode === 'accept' ? (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
              <label><div className="k">Project</div>
                <select className="inp" value={pick.projectSlug} onChange={(e) => setPick({ ...pick, projectSlug: e.target.value })}>
                  <option value="">Pick one</option>
                  {forClient.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="k">What is it</div>
                <select className="inp" value={pick.kind} onChange={(e) => setPick({ ...pick, kind: e.target.value })}>
                  {Object.keys(KINDS).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
                </select></label>
              <label><div className="k">Who does it</div>
                <select className="inp" value={pick.assignee} onChange={(e) => setPick({ ...pick, assignee: e.target.value })}>
                  <option value="">Nobody yet</option>
                  {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="k">Due</div><input className="inp" type="date" value={pick.due} onChange={(e) => setPick({ ...pick, due: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}><div className="k">Title</div>
                <input className="inp" value={pick.title} onChange={(e) => setPick({ ...pick, title: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}><div className="k">What counts as done</div>
                <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="So it cannot creep" /></label>
            </div>
          ) : (
            <label style={{ display: 'block' }}>
              <div className="k">{mode === 'decline' ? 'Why you are saying no' : 'Why it is parked and what unblocks it'}</div>
              <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>)}
          {err ? <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 7 }}>{err}</div> : null}
          <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
            <button className="btn dark" disabled={busy}
              onClick={() => send(mode, mode === 'accept' ? { ...pick, acceptance: note } : {})}>
              {busy ? 'Saving' : mode === 'accept' ? 'Open the work' : mode === 'decline' ? 'Decline it' : 'Park it'}
            </button>
            <button className="btn" onClick={() => { setMode(null); setErr(''); }}>Cancel</button>
          </div>
        </td></tr>) : null}
    </>
  );
}

export default function Requests({ clients, projects, people }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('open');
  const [adding, setAdding] = useState(false);

  function load() {
    fetch('/api/request').then((r) => r.json()).then((j) => (j.ok ? setD(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  }
  useEffect(load, []);

  const items = (d && d.items) || [];
  const open = items.filter((r) => r.state === 'new');
  const outOfScope = items.filter((r) => r.inScope === 'no');
  const closed = items.filter((r) => r.state !== 'new');
  const shown = tab === 'open' ? open : tab === 'scope' ? outOfScope : closed;

  return (
    <>
      {adding
        ? <LogForm clients={clients} projects={projects} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
        : <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setAdding(true)}>Log a request</button></div>}

      <div className="tabs">
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Not decided ({open.length})</button>
        <button className={tab === 'scope' ? 'on' : ''} onClick={() => setTab('scope')}>Outside the retainer ({outOfScope.length})</button>
        <button className={tab === 'closed' ? 'on' : ''} onClick={() => setTab('closed')}>Decided ({closed.length})</button>
      </div>

      <div className="panel" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not load requests</b><span className="err">{err}</span></div></div> : null}
        {!d && !err ? <div className="empty">Loading.</div> : null}
        {d ? (
          <table className="tbl">
            <thead><tr><th style={{ width: 120 }}>When</th><th style={{ width: 138 }}>Who</th><th>What they asked for</th><th style={{ width: 108 }}>Scope</th><th style={{ width: 150 }}>State</th><th style={{ width: 250 }} /></tr></thead>
            <tbody>
              {shown.map((r) => <Row key={r._id} r={r} projects={projects} people={people} canTriage={d.canTriage} reload={load} />)}
              {shown.length === 0 ? <tr><td colSpan={6} className="empty">
                {tab === 'open' ? 'Nothing waiting on a decision.' : tab === 'scope' ? 'Nothing logged as outside the retainer.' : 'Nothing decided yet.'}
              </td></tr> : null}
            </tbody>
          </table>) : null}
      </div>
      <p className="note">
        Marking something outside the retainer writes an escalation, so unpaid extras become a list you
        can put in front of a client at renewal rather than a feeling that the year was busier than it looked.
      </p>
    </>
  );
}
