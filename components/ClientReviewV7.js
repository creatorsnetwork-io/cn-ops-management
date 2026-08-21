'use client';
import { useEffect, useState } from 'react';

function pretty(w) {
  if (!w) return '';
  const a = new Date(w + 'T00:00:00Z'), b = new Date(w + 'T00:00:00Z');
  b.setUTCDate(b.getUTCDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return f(a) + ' to ' + f(b);
}
const day = (d) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
const mark = (s) => String(s || 'Client').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
function preview(link) {
  const m = /\/file\/d\/([^/]+)/.exec(link || '');
  return m ? 'https://drive.google.com/file/d/' + m[1] + '/preview' : null;
}

function Decision({ it, token, onDone }) {
  const [mode, setMode] = useState(false);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(decision) {
    if (decision === 'changes' && !comment.trim()) { setErr('Please tell us what to change.'); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/client/' + token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: it.key, decision, comment, by: name }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { onDone(it.key, j); setMode(false); setComment(''); } else setErr(j.error || 'That did not go through.');
  }

  if (it.decision && !mode) return <div className="rowb"><span className={'tag ' + (it.decision.decision === 'approved' ? 'ok' : 'bad')}>{it.decision.decision === 'approved' ? 'Approved' : 'Changes requested'}</span><span>{it.decision.by ? 'by ' + it.decision.by : ''}</span>{it.decision.comment ? <span>{it.decision.comment}</span> : null}<button className="btn sm" onClick={() => setMode(true)}>Change answer</button></div>;
  if (!mode) return <div className="rowb"><button className="btn dark" onClick={() => setMode(true)}>Approve post</button><button className="btn" onClick={() => setMode(true)}>Request a change</button></div>;
  return <div style={{ display: 'grid', gap: 8, width: '100%' }}><input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} /><textarea placeholder="What would you like changed? Leave blank if approving." value={comment} onChange={(e) => setComment(e.target.value)} />{err ? <div className="note" style={{ color: 'var(--bad)' }}>{err}</div> : null}<div className="rowb"><button className="btn dark" disabled={busy} onClick={() => send('approved')}>Approve post</button><button className="btn" disabled={busy} onClick={() => send('changes')}>Request changes</button><button className="btn" onClick={() => setMode(false)}>Cancel</button></div></div>;
}

export default function ClientReviewV7({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState('');
  const [channel, setChannel] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch('/api/client/' + token).then((r) => r.json()).then((j) => j.ok ? setD(j) : setErr(j.error)).catch((e) => setErr(String(e)));
  }, [token]);

  function onDone(key, res) {
    setD((prev) => ({ ...prev, items: prev.items.map((i) => i.key === key ? { ...i, decision: res } : i) }));
  }
  function open(it) { setSelected(it.key); setChannel(it.captions[0]?.channel || 'Content'); setShow(false); }

  const item = d?.items.find((x) => x.key === selected);
  const caption = item ? item.captions.find((x) => x.channel === channel) || item.captions[0] : null;
  const emb = item ? preview(item.creativeLink) : null;
  const done = d ? d.items.filter((x) => x.decision).length : 0;

  return (
    <div className="pshell">
      <aside className="pside">
        <div className="brand"><img src="/cn-logo.png" alt="Creators Network" /></div>
        <div className="grp"><div className="lbl">Shared with you</div><button className={'nav ' + (!item ? 'on' : '')} onClick={() => setSelected('')}>Shared calendar</button>{item ? <button className="nav on">{(item.title || item.type || 'Post').slice(0, 24)}</button> : null}</div>
        <div className="plock"><b>Private client view</b>Shared outputs only. Internal notes, capacity, QC discussion and assignments are excluded.</div>
      </aside>
      <div>
        <div className="top">
          <div className="crumb">{item ? <><button onClick={() => setSelected('')}>Shared calendar</button> / <b>{item.title || item.type}</b></> : <>{d?.client || 'Client'} / <b>Shared calendar</b></>}</div>
          {d ? <div className="cobrand"><span className="cmark" style={{ width: 28, height: 28, fontSize: 9 }}>{mark(d.client)}</span><div className="div" /><img src="/cn-logo.png" style={{ height: 30 }} alt="Creators Network" /></div> : null}
        </div>
        <main className="main">
          {err ? <div className="alertbar">{err}</div> : null}
          {!d && !err ? <div className="panel"><div className="pad note">Loading this calendar.</div></div> : null}
          {d && !item ? <>
            <div className="head"><div><div className="eyebrow">{d.client}</div><h1>{d.project}</h1><p className="lede">Content for {pretty(d.week)}. Open any item to read each channel exactly as it will publish.</p></div></div>
            <div className="guard">Files open from the shared Drive location. {done} of {d.items.length} post{d.items.length === 1 ? '' : 's'} answered.</div>
            <div className="panel">
              {d.items.map((it) => <div className="post" key={it.key}>
                <div className="dbox"><b>{it.date ? new Date(it.date + 'T00:00:00Z').getUTCDate() : '?'}</b><span>{it.date ? new Date(it.date + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) : 'Date'}</span></div>
                <div className="pc"><span className="tag mute">{it.type || 'Content'}</span><h4>{it.title || it.type || 'Post'}</h4><p>{it.captions[0]?.text?.slice(0, 130) || 'Creative file and details inside.'}</p><div style={{ marginTop: 8 }}><span className={'tag ' + (it.decision?.decision === 'approved' ? 'ok' : it.decision?.decision === 'changes' ? 'bad' : 'warn')}>{it.decision?.decision === 'approved' ? 'Approved' : it.decision?.decision === 'changes' ? 'Changes received' : 'Awaiting your review'}</span></div></div>
                <button className="btn dark" onClick={() => open(it)}>Open</button>
              </div>)}
            </div>
          </> : null}

          {d && item ? <>
            <div className="head"><div><div className="eyebrow">{day(item.date)} · {item.type || 'Content'}</div><h1>{item.title || item.type || 'Post'}</h1><p className="lede">The full copy for each available channel, exactly as it will publish.</p></div><button className="btn" onClick={() => setSelected('')}>Back</button></div>
            <div className="grid2">
              <div className="panel">
                <div className="chtabs" style={{ padding: '0 15px' }}>{item.captions.map((c) => <button className={'cht ' + (c.channel === (caption?.channel || channel) ? 'on' : '')} key={c.channel} onClick={() => setChannel(c.channel)}>{c.channel}</button>)}{!item.captions.length ? <span className="cht on">Content</span> : null}</div>
                <div className="pad art"><div className="cap">{caption?.text || item.creativeText || 'No copy is attached to this item.'}</div></div>
                <div style={{ padding: '13px 15px', borderTop: '1px solid var(--line2)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--head)' }}><Decision it={item} token={token} onDone={onDone} /><span className="note">The live approval applies to the post as a whole, not a separate channel record.</span></div>
              </div>
              <div className="panel"><header><h2>The creative</h2><span className="hint">shared from Drive</span></header><div className="pad">
                {emb && show ? <iframe className="prev" src={emb} allow="autoplay" title="Creative preview" /> : <div className="prev"><span>{item.type || 'Creative'} preview</span></div>}
                <div className="rowb" style={{ marginTop: 12 }}>{emb ? <button className="btn" onClick={() => setShow(!show)}>{show ? 'Hide preview' : 'Preview here'}</button> : null}{item.creativeLink ? <a className="btn" href={item.creativeLink} target="_blank" rel="noreferrer">Open in Drive</a> : <span className="note">The file is still coming.</span>}</div>
              </div></div>
            </div>
          </> : null}
        </main>
      </div>
    </div>
  );
}
