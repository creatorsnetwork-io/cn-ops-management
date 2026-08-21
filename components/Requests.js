'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KINDS, LABEL } from '../lib/work';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const CHAN = { whatsapp: 'WhatsApp', email: 'Email', call: 'Call', meeting: 'Meeting' };
const SCOPE = { yes: ['in scope', 'ok'], no: ['out of scope', 'bad'], unclear: ['scope unclear', 'warn'] };
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'Not set');

function requestType(r) {
  if (r.fault) return 'Fault';
  if (r.inScope === 'no') return 'Extra scope';
  if (r.workId) return 'Converted work';
  return 'Unclassified';
}

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
        <label><div className="fl">What they asked for, in their words</div>
          <textarea style={{ minHeight: 90 }} value={f.what} onChange={(e) => set('what', e.target.value)} /></label>
        <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <label><div className="fl">Who asked</div><input type="text" value={f.from} placeholder="Name at the client" onChange={(e) => set('from', e.target.value)} /></label>
          <label><div className="fl">When they want it</div><input type="date" value={f.due} onChange={(e) => set('due', e.target.value)} /></label>
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
        <td className="dim" style={{ whiteSpace: 'nowrap' }}>{when(r.at)}
          <div style={{ color: 'var(--faint)', fontSize: 12 }}>{CHAN[r.channel]}</div></td>
        <td>{r.clientName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{r.from || 'unnamed'}</div></td>
        <td>{r.projectName || <span className="tag warn">not linked</span>}</td>
        <td><span className={'tag ' + (r.fault ? 'bad' : 'info')}>{requestType(r)}</span></td>
        <td style={{ whiteSpace: 'pre-wrap' }}>{r.what}
          {r.decision ? <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 5 }}>Decision: {r.decision}</div> : null}</td>
        <td className="dim">{dayOf(r.due)}<div style={{ color: 'var(--faint)', fontSize: 11 }}>requested date</div></td>
        <td>{r.receivedBy || 'Not assigned'}<div style={{ color: 'var(--faint)', fontSize: 12 }}>intake owner</div></td>
        <td>
          <span className={'tag ' + (r.state === 'accepted' ? 'ok' : r.state === 'declined' ? 'bad' : r.state === 'parked' ? 'warn' : 'mute')}>{r.state}</span>
          <div style={{ marginTop: 4 }}><span className={'tag ' + sc[1]}>{sc[0]}</span></div>
          {r.workId ? <div style={{ marginTop: 4 }}><Link href={'/work/' + r.workId} style={{ fontSize: 12.5 }}>{LABEL[r.workState] || 'open'}: {r.workTitle}</Link></div> : null}
        </td>
        <td>
          {canTriage ? (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <Link className="btn sm" href={'/requests/' + encodeURIComponent(r._id)}>Open</Link>
              {r.state === 'new' ? <>
                {r.inScope !== 'yes' ? <button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'yes' })}>In scope</button> : null}
                {r.inScope !== 'no' ? <button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'no' })}>Out of scope</button> : null}
                <button className="btn sm dark" onClick={() => setMode('accept')}>Turn into work</button>
                <button className="btn sm" onClick={() => setMode('decline')}>Decline</button>
                <button className="btn sm" onClick={() => setMode('park')}>Park</button>
              </> : <button className="btn sm" disabled={busy} onClick={() => send('reopen')}>Reopen</button>}
            </div>) : <Link className="btn sm" href={'/requests/' + encodeURIComponent(r._id)}>Open</Link>}
        </td>
      </tr>
      {mode ? (
        <tr><td colSpan={9} style={{ background: '#FCFDFE' }}>
          {mode === 'accept' ? (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
              <label><div className="fl">Project</div>
                <select className="f" value={pick.projectSlug} onChange={(e) => setPick({ ...pick, projectSlug: e.target.value })}>
                  <option value="">Pick one</option>
                  {forClient.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="fl">What is it</div>
                <select className="f" value={pick.kind} onChange={(e) => setPick({ ...pick, kind: e.target.value })}>
                  {Object.keys(KINDS).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
                </select></label>
              <label><div className="fl">Who does it</div>
                <select className="f" value={pick.assignee} onChange={(e) => setPick({ ...pick, assignee: e.target.value })}>
                  <option value="">Nobody yet</option>
                  {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="fl">Due</div><input type="date" value={pick.due} onChange={(e) => setPick({ ...pick, due: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}><div className="fl">Title</div>
                <input type="text" value={pick.title} onChange={(e) => setPick({ ...pick, title: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}><div className="fl">What counts as done</div>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="So it cannot creep" /></label>
            </div>
          ) : (
            <label style={{ display: 'block' }}>
              <div className="fl">{mode === 'decline' ? 'Why you are saying no' : 'Why it is parked and what unblocks it'}</div>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
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
      <div className="head"><div><div className="eyebrow">Unplanned work</div><h1>Requests</h1>
        <p className="lede">Capture the ask first. Scope, due date and ownership come from the linked project and the person who makes the decision.</p></div>
        <button className="btn dark" onClick={() => setAdding(true)}>Log request</button></div>

      <div className="alertbar"><span><b>Faults behave differently.</b> They should skip normal lead time and route to Aashif as urgent.</span>
        <span className="tag bad">API field required</span></div>

      {adding
        ? <LogForm clients={clients} projects={projects} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
        : null}

      <div className="tabsrow">
        <button className={'tb ' + (tab === 'open' ? 'on' : '')} onClick={() => setTab('open')}>Not decided ({open.length})</button>
        <button className={'tb ' + (tab === 'scope' ? 'on' : '')} onClick={() => setTab('scope')}>Outside the retainer ({outOfScope.length})</button>
        <button className={'tb ' + (tab === 'closed' ? 'on' : '')} onClick={() => setTab('closed')}>Decided ({closed.length})</button>
      </div>

      <div className="panel">
        {err ? <div className="alertbar"><span><b>Could not load requests.</b> {err}</span></div> : null}
        {!d && !err ? <div className="pad note">Loading.</div> : null}
        {d ? (
          <table>
            <thead><tr><th style={{ width: 120 }}>In</th><th style={{ width: 130 }}>Client</th><th style={{ width: 145 }}>Project</th><th style={{ width: 120 }}>Type</th>
              <th>What</th><th style={{ width: 95 }}>Earliest</th><th style={{ width: 110 }}>Owner</th><th style={{ width: 130 }}>State</th><th style={{ width: 250 }} /></tr></thead>
            <tbody>
              {shown.map((r) => <Row key={r._id} r={r} projects={projects} people={people} canTriage={d.canTriage} reload={load} />)}
              {shown.length === 0 ? <tr><td colSpan={9} className="dim">
                {tab === 'open' ? 'Nothing waiting on a decision.' : tab === 'scope' ? 'Nothing logged as outside the retainer.' : 'Nothing decided yet.'}
              </td></tr> : null}
            </tbody>
          </table>) : null}
      </div>
      <div className="panel"><header><div><h2>Types with a template</h2><div className="sub2">Repeatable asks start from a known structure.</div></div></header>
        <table><tbody>
          {[['Award nomination','Post structure, caption skeleton, asset list and approval path'],
            ['Event participation','Pre-event, on-ground and post-event set, plus a client footage checklist'],
            ['New joiner','Photo specification, bio questions, caption structure and channel plan'],
            ['Fault','Skips lead time, routes to Aashif and is urgent by default']].map((r) => (
              <tr key={r[0]}><td className="b" style={{ width: 180 }}>{r[0]}</td><td className="dim">{r[1]}</td>
                <td style={{ width: 130 }}><span className={'tag ' + (r[0] === 'Fault' ? 'bad' : 'info')}>{r[0] === 'Fault' ? 'needs API field' : 'template'}</span></td></tr>))}
        </tbody></table>
      </div>
      <p className="note">
        Marking something outside the retainer writes an escalation, so unpaid extras become a list you
        can put in front of a client at renewal rather than a feeling that the year was busier than it looked.
      </p>
      <p className="note">The current request API does not accept or return a request type or fault marker. The catalogue and Fault rule are visible here, but operational Fault routing cannot be enabled without an API change.</p>
    </>
  );
}
