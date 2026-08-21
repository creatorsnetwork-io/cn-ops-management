'use client';
import { useEffect, useState } from 'react';

function pretty(w) {
  if (!w) return '';
  const a = new Date(w + 'T00:00:00Z'), b = new Date(w + 'T00:00:00Z');
  b.setUTCDate(b.getUTCDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return f(a) + ' to ' + f(b);
}
const day = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

// Turn a Drive share link into something that can be shown on the page.
function preview(link) {
  const m = /\/file\/d\/([^/]+)/.exec(link || '');
  if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  return null;
}

function Post({ it, token, onDone }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const dec = it.decision;
  const emb = preview(it.creativeLink);

  async function send(decision) {
    if (decision === 'changes' && !comment.trim()) { setErr('Please tell us what to change.'); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/client/' + token, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: it.key, decision, comment, by: name }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) { onDone(it.key, j); setMode(null); setComment(''); }
    else setErr(j.error || 'That did not go through.');
  }

  return (
    <div className="cpost">
      <div className="ch">
        <b>{it.title || it.type || 'Post'}</b>
        <span>{day(it.date)}{it.channel ? ' · ' + it.channel : ''}{it.type && it.title ? ' · ' + it.type : ''}</span>
      </div>
      <div className="cb">
        {it.captions.length === 0 ? <p style={{ color: 'var(--faint)', fontSize: 13 }}>No caption for this one.</p> : null}
        {it.captions.map((c, k) => (
          <div className="cap" key={k}>
            <div className="cl">{c.channel}</div>
            <div className="ct">{c.text}</div>
          </div>
        ))}
        {it.creativeLink ? (
          <div style={{ marginTop: 6 }}>
            {emb && show ? <iframe className="cprev" src={emb} allow="autoplay" title="creative" />
              : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {emb ? <button className="cbtn" onClick={() => setShow(true)}>Show the file here</button> : null}
                  <a className="cbtn" href={it.creativeLink} target="_blank" rel="noreferrer">Open in Google Drive</a>
                </div>}
            {emb && show ? <div style={{ marginTop: 8 }}><button className="cbtn" onClick={() => setShow(false)}>Hide</button></div> : null}
          </div>
        ) : <p style={{ color: 'var(--faint)', fontSize: 13 }}>The file for this one is still coming.</p>}
      </div>

      <div className="cfoot">
        {dec && !mode ? (
          <>
            <span className={dec.decision === 'approved' ? 'ok' : 'no'}>
              {dec.decision === 'approved' ? 'Approved' : 'Changes requested'}{dec.by ? ' by ' + dec.by : ''}
            </span>
            {dec.comment ? <span style={{ fontSize: 13, color: 'var(--muted)' }}>“{dec.comment}”</span> : null}
            <button className="cbtn" onClick={() => setMode('again')}>Change my answer</button>
          </>
        ) : mode ? (
          <div style={{ width: '100%' }}>
            <input className="inp" style={{ marginBottom: 8 }} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="inp" placeholder="What would you like changed? Leave blank if you are approving." value={comment} onChange={(e) => setComment(e.target.value)} />
            {err ? <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 6 }}>{err}</div> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
              <button className="cbtn go" disabled={busy} onClick={() => send('approved')}>Approve this post</button>
              <button className="cbtn ch" disabled={busy} onClick={() => send('changes')}>Request changes</button>
              <button className="cbtn" onClick={() => { setMode(null); setErr(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <button className="cbtn go" onClick={() => setMode('new')}>Approve</button>
            <button className="cbtn ch" onClick={() => setMode('new')}>Request changes</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ClientReview({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/client/' + token).then((r) => r.json())
      .then((j) => (j.ok ? setD(j) : setErr(j.error)))
      .catch((e) => setErr(String(e)));
  }, [token]);

  function onDone(key, res) {
    setD((prev) => ({ ...prev, items: prev.items.map((i) => (i.key === key ? { ...i, decision: res } : i)) }));
  }

  const done = d ? d.items.filter((i) => i.decision).length : 0;

  return (
    <div className="cwrap">
      <div className="chead">
        <img src="/cn-logo.png" alt="Creators Network" />
        {d ? <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{d.client}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)' }}>{pretty(d.week)}</div>
        </div> : null}
      </div>

      {err ? <div className="alert" style={{ marginTop: 24 }}>{err}</div> : null}
      {!d && !err ? <p className="lede" style={{ marginTop: 26 }}>Loading this week.</p> : null}

      {d ? (
        <>
          <h1 style={{ marginTop: 26 }}>Content for the week of {pretty(d.week)}</h1>
          <p className="lede">
            {d.items.length} post{d.items.length === 1 ? '' : 's'}. Approve each one, or tell us what to change.
            {done ? ' ' + done + ' answered so far.' : ''}
          </p>
          {d.items.map((it) => <Post key={it.key} it={it} token={token} onDone={onDone} />)}
          <p className="note" style={{ marginTop: 24 }}>
            Anything you approve here is recorded with the exact wording and file you saw at the time.
          </p>
        </>
      ) : null}
    </div>
  );
}
