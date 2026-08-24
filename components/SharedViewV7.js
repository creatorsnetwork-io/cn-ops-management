'use client';
import { useEffect, useState } from 'react';

const dayOf = (d) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'Not set';
const when = (t) => t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function Reply({ d, token }) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');

  async function reply(kind) {
    setBusy(kind); setErr('');
    const r = await fetch('/api/shared/' + token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, by: name, text }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setSent(kind); setText(''); } else setErr(j.error);
  }

  return <div className="panel"><header><h2>Your reply</h2><span className="hint">{(d.responses || []).length ? (d.responses || []).length + ' recorded' : 'Nothing sent yet'}</span></header><div className="pad">
    {(d.responses || []).map((r, i) => <div className="ref" key={i}><div className="rc"><b>{r.by}</b> {r.kind === 'accepted' ? 'took the job' : r.kind === 'declined' ? 'turned it down' : 'asked'}{r.text ? ': ' + r.text : ''}</div><div className="rm">{when(r.at)}</div></div>)}
    {sent ? <div className="guard">{sent === 'accepted' ? 'Thank you. The job acceptance is recorded.' : sent === 'declined' ? 'Understood. The team can now reassign it.' : 'Your question is on the work item for the team.'}</div> : <>
      <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea placeholder="A question, or anything you need before you start" value={text} onChange={(e) => setText(e.target.value)} />
      {err ? <div className="note" style={{ color: 'var(--bad)' }}>{err}</div> : null}
      <div className="rowb"><button className="btn dark" disabled={busy} onClick={() => reply('accepted')}>I have got this</button><button className="btn" disabled={busy} onClick={() => reply('question')}>Ask a question</button><button className="btn" disabled={busy} onClick={() => reply('declined')}>I cannot take it</button></div>
    </>}
  </div></div>;
}

function Brief({ d, token }) {
  return <>
    <div className="panel"><header><h2>The brief</h2><span className="tag ok">Checked before sending</span></header><table><tbody>
      <tr><td className="dim" style={{ width: 180 }}>Deliverable</td><td className="b">{d.title}</td></tr>
      <tr><td className="dim">Kind</td><td className="b">{d.kind === 'brief' ? 'Job brief' : d.kind}</td></tr>
      <tr><td className="dim">Brief</td><td className="cap">{d.brief || 'Not written'}</td></tr>
      <tr><td className="dim">What counts as done</td><td className="cap">{d.acceptance || 'Ask before starting'}</td></tr>
      <tr><td className="dim">Deadline</td><td className="b">{dayOf(d.due)}</td></tr>
      <tr><td className="dim">Files and references</td><td className="rowb">{d.driveLink ? <a className="btn sm" href={d.driveLink} target="_blank" rel="noreferrer">Drive files</a> : <span className="dim">No Drive folder linked</span>}{d.docLink ? <a className="btn sm" href={d.docLink} target="_blank" rel="noreferrer">Working document</a> : null}</td></tr>
    </tbody></table></div>

    {(d.responses || []).filter((r) => r.kind === 'question').length ? <div className="panel"><header><h2>Round notes</h2></header><div className="pad">{(d.responses || []).filter((r) => r.kind === 'question').map((r, i) => <div className="ref" key={i}><div className="rc">{r.text}</div><div className="rm">{r.by}, {when(r.at)}</div></div>)}</div></div> : null}

    <Reply d={d} token={token} />

    <div className="panel"><header><h2>Deliver</h2></header><div className="pad"><div className="fl">Paste the Drive link to your output</div><input type="text" disabled placeholder="https://drive.google.com/..." /><div className="fl" style={{ marginTop: 13 }}>Anything we should know</div><textarea disabled placeholder="Optional note" /><div style={{ marginTop: 13 }}><button className="btn dark" disabled title="The shared-link API has no delivery submission action">Submit round</button></div><p className="note" style={{ marginTop: 9 }}>The current shared-link API accepts job replies but has no delivery submission action. The controls stay disabled until that endpoint exists.</p></div></div>
  </>;
}

function CallSheet({ d, token }) {
  const cs = d.callSheet;
  return <>
    {!cs ? <div className="alertbar">The call sheet has not been filled in yet.</div> : <div className="panel"><header><h2>{dayOf(cs.date)}</h2><span className="hint">{cs.callTime ? 'Call ' + cs.callTime : ''}{cs.wrapTime ? ' · wrap ' + cs.wrapTime : ''}</span></header><table><tbody>
      <tr><td className="dim" style={{ width: 170 }}>Where</td><td className="b">{cs.location || 'Not stated'}{cs.mapLink ? <div><a href={cs.mapLink} target="_blank" rel="noreferrer">Open map</a></div> : null}</td></tr>
      <tr><td className="dim">Who to call</td><td>{(cs.contacts || []).map((c, i) => <div key={i}>{c.name}{c.role ? ', ' + c.role : ''}{c.phone ? ' · ' + c.phone : ''}</div>)}</td></tr>
      <tr><td className="dim">Running order</td><td>{(cs.schedule || []).map((s, i) => <div key={i}><b>{s.time}</b>{s.time ? ' · ' : ''}{s.what}</div>)}</td></tr>
      {cs.kit ? <tr><td className="dim">Kit</td><td className="cap">{cs.kit}</td></tr> : null}
      {cs.notes ? <tr><td className="dim">Anything else</td><td className="cap">{cs.notes}</td></tr> : null}
    </tbody></table></div>}
    <Reply d={d} token={token} />
  </>;
}

export default function SharedViewV7({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/shared/' + token).then((r) => r.json()).then((j) => j.ok ? setD(j) : setErr(j.error)).catch((e) => setErr(String(e))); }, [token]);

  return <div className="pshell">
    <aside className="pside"><div className="brand"><img src="/cn-logo.png" className="cnlogo" alt="Creators Network" /></div><div className="grp"><div className="lbl">This job only</div><button className="nav on">{d?.kind === 'callsheet' ? 'Call sheet and reply' : 'Brief and delivery'}</button></div><div className="plock"><b>No account needed</b>One job, one link. It carries no commercial or internal operations data.</div></aside>
    <div><div className="top"><div className="crumb"><b>{d?.kind === 'callsheet' ? 'Call sheet' : 'Job brief'}</b></div><img src="/cn-logo.png" style={{ height: 30, width: 'auto' }} alt="Creators Network" /></div><main className="main">
      {err ? <div className="alertbar">{err}</div> : null}{!d && !err ? <div className="panel"><div className="pad note">Loading.</div></div> : null}
      {d ? <><div className="head"><div><div className="eyebrow">{d.client} · {d.project}</div><h1>{d.title}</h1><p className="lede">Everything needed for this job is on this page. Due {dayOf(d.due)}.</p></div></div>{d.note ? <div className="guard">{d.note}</div> : null}{d.kind === 'brief' ? <Brief d={d} token={token} /> : <CallSheet d={d} token={token} />}<p className="note">You do not need an account. Every working reply lands on the job itself.</p></> : null}
    </main></div>
  </div>;
}
