'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LABEL } from '../lib/work';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

function FeedbackCard({ item, canTriage }) {
  const [evidence, setEvidence] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const source = item.kind === 'social' ? '/projects/' + item.projectSlug + '/review?week=' + item.week : '/work/' + item.workId;
  const state = item.kind === 'work' && item.workState === 'progress' ? 'In revision'
    : item.kind === 'work' && item.workState === 'client' ? 'Back with client' : 'Needs triage';

  async function loadEvidence() {
    setBusy('evidence'); setErr('');
    const r = await fetch('/api/review?slug=' + encodeURIComponent(item.projectSlug) + '&week=' + item.week);
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    setEvidence((j.items || []).find((i) => i.key === item.key) || { missing: true });
  }

  async function resolve() {
    setBusy('resolve'); setErr('');
    const r = await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'feedbackDone', id: item.workId, key: item.feedbackKey }) });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    window.location.reload();
  }

  async function outOfScope() {
    setBusy('scope'); setErr('');
    const logged = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'log', clientSlug: item.clientSlug, projectSlug: item.projectSlug,
        from: 'Client feedback', channel: 'meeting', what: 'Feedback on ' + item.title + ': ' + item.text }) });
    const first = await logged.json();
    if (!first.ok) { setBusy(''); setErr(first.error); return; }
    const scoped = await fetch('/api/request', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'scope', id: first.id, inScope: 'no' }) });
    const second = await scoped.json();
    if (!second.ok) { setBusy(''); setErr(second.error); return; }
    await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'feedbackDone', id: item.workId, key: item.feedbackKey }) });
    window.location.reload();
  }

  const captions = evidence && (evidence.captions || []).filter((c) => c.has);
  return (
    <div className="fb">
      <div className="ft"><span className="tchip">{item.client}</span><span>{item.projectName}</span>
        <span className={'tag ' + (state === 'Needs triage' ? 'warn' : state === 'In revision' ? 'info' : 'tl')} style={{ marginLeft: 'auto' }}>{state}</span></div>
      <h3>{item.title}</h3>
      <div className="ref"><div className="rl">What the client was looking at</div>
        {item.kind === 'social' ? (
          evidence ? <>
            <div className="rc">{evidence.missing ? 'The source row is no longer present.'
              : captions && captions.length ? captions.map((c) => c.channel + ': ' + c.text).join('\n\n') : 'No caption is present on the current row.'}</div>
            <div className="rm">Week of {dayOf(item.week)} · sheet row {evidence.sheetRow || 'not found'}</div>
          </> : <><div className="rc">{item.label}</div><div className="rm">Load the current caption from the live sheet.</div></>
        ) : <><div className="rc">{item.driveLink ? 'The delivered output is linked in Drive.' : 'No Drive output is linked yet.'}</div>
          <div className="rm">Work item: {item.title} · {LABEL[item.workState] || item.workState} · owner {item.owner || 'nobody'}</div></>}
      </div>
      <div className="q">{item.text || 'Changes requested without a written comment.'}</div>
      <div className="meta">{item.by || 'the client'} · {when(item.at)} · {item.kind === 'social' ? 'client review link' : 'work item'} · round {item.round} · included rounds not set</div>
      {err ? <div className="qc-error">{err}</div> : null}
      <div className="acts">
        {item.kind === 'social' && !evidence ? <button className="btn sm" disabled={busy === 'evidence'} onClick={loadEvidence}>{busy === 'evidence' ? 'Reading' : 'Load source'}</button> : null}
        <Link className="btn dark" href={source}>Create revision</Link>
        <Link className="btn" href={source}>Ask client</Link>
        {item.kind === 'work' && canTriage ? <button className="btn" disabled={busy === 'resolve'} onClick={resolve}>Resolve, no change</button>
          : <Link className="btn" href={source}>Resolve, no change</Link>}
        {item.kind === 'work' && canTriage && item.clientSlug && item.projectSlug
          ? <button className="btn" disabled={busy === 'scope'} onClick={outOfScope}>{busy === 'scope' ? 'Logging request' : 'Out of scope'}</button>
          : <Link className="btn" href="/requests">Out of scope</Link>}
        <Link className="btn sm" href={source}>Open source</Link>
      </div>
    </div>
  );
}

function LogFeedback({ candidates, onClose }) {
  const [workId, setWorkId] = useState(candidates[0]?._id || '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'move', id: workId, verb: 'clientBack', note: text }) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr(j.error); return; }
    window.location.reload();
  }

  return (
    <div className="panel feedback-log"><header><div><h2>Log feedback on other work</h2><div className="sub2">This uses the live Client asked for changes action and moves the item into revision.</div></div>
      <button className="btn sm" onClick={onClose}>Cancel</button></header>
      <div className="pad feedback-log-grid">
        <label><div className="lbl">Work with the client now</div><select className="inp" value={workId} onChange={(e) => setWorkId(e.target.value)}>
          {candidates.map((i) => <option key={i._id} value={i._id}>{i.client} · {i.projectName} · {i.title}</option>)}</select></label>
        <label><div className="lbl">What the client asked for</div><textarea className="inp" value={text} onChange={(e) => setText(e.target.value)} /></label>
        {err ? <div className="qc-error">{err}</div> : null}
        <div className="rowb"><button className="btn dark" disabled={busy || !workId || !text.trim()} onClick={save}>{busy ? 'Saving' : 'Log feedback'}</button>
          <Link className="btn" href="/calendar">Feedback on a social post starts from its weekly review</Link></div>
      </div>
    </div>
  );
}

export default function FeedbackBoard({ weeks, work, candidates, canTriage }) {
  const [project, setProject] = useState('all');
  const [logging, setLogging] = useState(false);
  const items = useMemo(() => {
    const social = [];
    for (const w of weeks) {
      const labels = {};
      for (const f of w.flags || []) if (f.label) labels[f.key] = f.label;
      for (const d of (w.clientDecisions || []).filter((x) => x.decision === 'changes')) {
        social.push({ kind: 'social', key: d.key, text: d.comment, by: d.by, at: d.at, week: w.week,
          projectSlug: w.projectSlug, projectName: w.projectName, client: w.client, clientSlug: w.clientSlug,
          title: labels[d.key] || d.key, label: labels[d.key] || d.key, round: 'not recorded' });
      }
    }
    const other = work.flatMap((w) => (w.feedback || []).filter((f) => !f.resolved).map((f, n) => ({
      kind: 'work', workId: w._id, feedbackKey: f._key, text: f.text, by: f.who === 'client' ? 'the client' : f.who,
      at: f.at, title: w.title, projectSlug: w.projectSlug, projectName: w.projectName, client: w.client,
      clientSlug: w.clientSlug, owner: w.assigneeName, workState: w.state, driveLink: w.driveLink, round: n + 1,
    })));
    return social.concat(other);
  }, [weeks, work]);
  const projects = useMemo(() => {
    const seen = {};
    for (const item of items) if (!seen[item.projectSlug]) seen[item.projectSlug] = item;
    return Object.values(seen);
  }, [items]);
  const shown = project === 'all' ? items : items.filter((i) => i.projectSlug === project);
  const revisions = items.filter((i) => i.kind === 'work' && i.workState === 'progress').length;
  const back = items.filter((i) => i.kind === 'work' && i.workState === 'client').length;

  return (
    <>
      <div className="head"><div><div className="eyebrow">Safeguarded intake</div><h1>Client feedback</h1>
        <p className="lede">Each item keeps the client comment beside the output it refers to. Internal work changes only through an explicit triage action.</p></div>
        {canTriage ? <button className="btn dark" disabled={!candidates.length} onClick={() => setLogging(true)}>Log feedback</button> : null}</div>

      <div className="kpis">
        <div className="kpi"><span className="d r" /><div className="lbl">Needs triage</div><div className="v">{items.length - revisions - back}</div><div className="n">no task created automatically</div></div>
        <div className="kpi"><div className="lbl">In revision</div><div className="v">{revisions}</div><div className="n">assigned internally</div></div>
        <div className="kpi"><span className="d a" /><div className="lbl">Back with the client</div><div className="v">{back}</div><div className="n">awaiting approval</div></div>
        <div className="kpi"><span className="d r" /><div className="lbl">Beyond included rounds</div><div className="v sm">Not recorded</div><div className="n bad">the current API has no included-round field</div></div>
      </div>

      <div className="guard"><b>Safeguard in effect.</b> Feedback never auto-assigns a team member and never rewrites the Brand Brain. Brand learning stays a separate approval decision.</div>
      {logging ? <LogFeedback candidates={candidates} onClose={() => setLogging(false)} /> : null}
      {canTriage && !candidates.length ? <p className="note">There is no work currently with a client, so manual feedback intake is disabled. Social comments continue through the weekly review link.</p> : null}

      <div className="filters feedback-filters"><button className={'fchip ' + (project === 'all' ? 'on' : '')} onClick={() => setProject('all')}>All projects</button>
        {projects.map((p) => <button key={p.projectSlug} className={'fchip ' + (project === p.projectSlug ? 'on' : '')}
          onClick={() => setProject(p.projectSlug)}>{p.client} · {p.projectName}</button>)}</div>
      <div className="cards feedback-cards">{shown.map((item, n) => <FeedbackCard key={item.kind + (item.workId || item.projectSlug) + (item.feedbackKey || item.key) + n}
        item={item} canTriage={canTriage} />)}</div>
      {!shown.length ? <div className="panel"><div className="empty">No open feedback in this view.</div></div> : null}
      <p className="note">Revision round numbers and included-round limits are not stored by the current APIs. Existing work feedback is ordered as received; social feedback keeps the source week but does not invent a round count.</p>
    </>
  );
}
