'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KINDS, LABEL } from '../lib/work';

const when = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set');

function typeOf(r) {
  if (r.fault) return 'Fault';
  if (r.inScope === 'no') return 'Extra scope';
  if (r.workId) return 'Converted work';
  return 'Unclassified';
}

export default function RequestDetail({ request: r, projects, people, canTriage }) {
  const router = useRouter();
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState({ projectSlug: r.projectSlug || projects[0]?.slug || '', kind: 'other', assignee: '',
    title: (r.what || '').slice(0, 80), due: r.due || '' });

  async function send(action, extra) {
    setBusy(true); setErr('');
    const res = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id: r._id, note, ...(extra || {}) }) });
    const j = await res.json(); setBusy(false);
    if (!j.ok) { setErr(j.error); return; }
    setMode(''); setNote(''); router.refresh();
  }

  const stateLabel = r.state === 'new' ? 'New, not triaged' : r.state === 'accepted' ? 'Converted to work'
    : r.state === 'declined' ? 'Declined' : r.state === 'parked' ? 'Parked' : r.state;

  return (
    <>
      <Link className="btn sm" href="/requests">Back to requests</Link>
      <div className="head"><div><div className={'eyebrow ' + (r.fault ? '' : 'n')}>{r.fault ? 'Fault, urgent' : 'Request'}</div><h1>{r.what}</h1>
        <p className="lede">{r.clientName} · {r.projectName || 'Project not linked'} · came in on {when(r.at)} via {r.channel || 'unknown'}.</p></div>
        <div className="rowb">{r.projectSlug ? <Link className="btn" href={'/projects/' + r.projectSlug}>Open project</Link> : null}
          {r.workId ? <Link className="btn dark" href={'/work/' + r.workId}>Open work</Link> : null}
          {canTriage && r.state === 'new' ? <button className="btn dark" onClick={() => setMode('triage')}>Triage</button> : null}
          {canTriage && r.state !== 'new' ? <button className="btn" disabled={busy} onClick={() => send('reopen')}>Reopen</button> : null}</div>
      </div>

      <div className="stats">
        <div><div className="lbl">State</div><div className="v">{stateLabel}</div><div className="s">{r.decidedBy ? 'decided by ' + r.decidedBy : 'waiting for a decision'}</div></div>
        <div><div className="lbl">Type</div><div className="v">{typeOf(r)}</div><div className="s">the API has no saved type field</div></div>
        <div><div className="lbl">Earliest delivery</div><div className="v">{when(r.due)}</div><div className="s">current record stores the requested due date</div></div>
        <div><div className="lbl">Scope</div><div className="v">{r.inScope === 'yes' ? 'Within retainer' : r.inScope === 'no' ? 'Beyond baseline' : 'Unclear'}</div>
          <div className="s">{r.inScope === 'no' ? 'writes an escalation' : 'no quote created automatically'}</div></div>
      </div>

      {mode ? <div className="panel"><header><div><h2>{mode === 'triage' ? 'Where it goes' : mode === 'accept' ? 'Turn it into work' : mode === 'decline' ? 'Decline it' : 'Park it'}</h2>
        <div className="sub2">Every saved decision uses the existing request workflow and activity log.</div></div><button className="btn sm" onClick={() => setMode('')}>Cancel</button></header>
        <div className="pad">
          {mode === 'triage' ? <div>
            <div className="chk"><div className="box" /><div className="tx"><b>In scope, planned</b><span>Mark it inside the retainer</span></div><button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'yes' })}>Choose</button></div>
            <div className="chk now"><div className="box" /><div className="tx"><b>In scope, turn into work</b><span>Pick owner, kind and due date</span></div><button className="btn sm dark" onClick={() => setMode('accept')}>Choose</button></div>
            <div className="chk"><div className="box" /><div className="tx"><b>Out of scope</b><span>Record it and raise the existing escalation</span></div><button className="btn sm" disabled={busy} onClick={() => send('scope', { inScope: 'no' })}>Choose</button></div>
            <div className="chk"><div className="box" /><div className="tx"><b>Fault</b><span>Needs a fault field and routing action in the API</span></div><button className="btn sm off" disabled>Unavailable</button></div>
            <div className="chk"><div className="box" /><div className="tx"><b>Decline</b><span>Keep a reason the client can be shown</span></div><button className="btn sm" onClick={() => setMode('decline')}>Choose</button></div>
            <div className="chk"><div className="box" /><div className="tx"><b>Park</b><span>Record what must happen before it reopens</span></div><button className="btn sm" onClick={() => setMode('park')}>Choose</button></div>
          </div> : null}
          {mode === 'accept' ? <div className="two-in" style={{ marginTop: 0 }}>
            <label><div className="fl">Project</div><select className="f" value={pick.projectSlug} onChange={(e) => setPick({ ...pick, projectSlug: e.target.value })}>
              <option value="">Pick one</option>{projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
            <label><div className="fl">What is it</div><select className="f" value={pick.kind} onChange={(e) => setPick({ ...pick, kind: e.target.value })}>
              {Object.keys(KINDS).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}</select></label>
            <label><div className="fl">Who does it</div><select className="f" value={pick.assignee} onChange={(e) => setPick({ ...pick, assignee: e.target.value })}>
              <option value="">Nobody yet</option>{people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
            <label><div className="fl">Due</div><input type="date" value={pick.due} onChange={(e) => setPick({ ...pick, due: e.target.value })} /></label>
            <label style={{ gridColumn: '1 / -1' }}><div className="fl">Title</div><input type="text" value={pick.title} onChange={(e) => setPick({ ...pick, title: e.target.value })} /></label>
            <label style={{ gridColumn: '1 / -1' }}><div className="fl">What counts as done</div><input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div style={{ gridColumn: '1 / -1' }}><button className="btn dark" disabled={busy} onClick={() => send('accept', { ...pick, acceptance: note })}>{busy ? 'Saving' : 'Open the work'}</button></div>
          </div> : null}
          {['decline', 'park'].includes(mode) ? <><label><div className="fl">{mode === 'decline' ? 'Why you are saying no' : 'What unblocks it'}</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn dark" disabled={busy || !note.trim()} onClick={() => send(mode)}>{busy ? 'Saving' : mode === 'decline' ? 'Decline it' : 'Park it'}</button></> : null}
          {err ? <div className="note" style={{ color: 'var(--bad)', marginTop: 7 }}>{err}</div> : null}
        </div>
      </div> : null}

      <div className="grid2">
        <div className="panel"><header><h2>The ask</h2></header><div className="pad"><p style={{ fontSize: 13.5 }}>{r.what}</p>
          <div className="ref"><div className="rl">Intake record</div><div className="rc">Asked by {r.from || 'unnamed client contact'} via {r.channel || 'unknown'}.</div>
            <div className="rm">Logged by {r.receivedBy || 'unknown'} on {when(r.at)}.</div></div>
          {r.decision ? <div className="ref"><div className="rl">Decision</div><div className="rc">{r.decision}</div><div className="rm">{r.decidedBy} · {when(r.decidedAt)}</div></div> : null}
        </div></div>
        <div className="panel"><header><h2>Where it can go</h2></header><table><tbody>
          {[['In scope, planned','Becomes work through the existing conversion action'],['In scope, urgent','Owner decides priority after conversion'],
            ['Out of scope','Writes the live escalation and stays on record'],['Fault','Requires the missing API fault field and Aashif routing']].map((x) => (
              <tr key={x[0]}><td className="b" style={{ width: 155 }}>{x[0]}</td><td className="dim">{x[1]}</td></tr>))}
        </tbody></table><div className="pad" style={{ borderTop: '1px solid var(--line2)' }}><p className="note">Every saved state change is written to the existing activity log with the person and time.</p></div></div>
      </div>
      {r.workId ? <p className="note">This request became <Link href={'/work/' + r.workId}>{r.workTitle}</Link>, currently {LABEL[r.workState] || r.workState}.</p> : null}
    </>
  );
}
