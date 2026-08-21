'use client';
import { useEffect, useState } from 'react';

const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '');
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function SharedView({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState(null);

  useEffect(() => {
    fetch('/api/shared/' + token).then((r) => r.json())
      .then((j) => (j.ok ? setD(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  }, [token]);

  async function reply(kind) {
    setBusy(kind); setErr('');
    const r = await fetch('/api/shared/' + token, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, by: name, text }),
    });
    const j = await r.json(); setBusy('');
    if (j.ok) { setSent(kind); setText(''); } else setErr(j.error);
  }

  const cs = d && d.callSheet;

  return (
    <div className="cwrap">
      <div className="chead">
        <img src="/cn-logo.png" alt="Creators Network" />
        {d ? <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{d.client}</div>
          <div style={{ fontSize: 12, color: 'var(--faint)' }}>{d.kind === 'brief' ? 'Job brief' : 'Call sheet'}</div>
        </div> : null}
      </div>

      {err ? <div className="alert" style={{ marginTop: 24 }}>{err}</div> : null}
      {!d && !err ? <p className="lede" style={{ marginTop: 26 }}>Loading.</p> : null}

      {d ? (
        <>
          <h1 style={{ marginTop: 26 }}>{d.title}</h1>
          <p className="lede">
            {d.project}{d.due ? ' · needed by ' + dayOf(d.due) : ''}
          </p>
          {d.note ? <div className="guard" style={{ marginTop: 14 }}>{d.note}</div> : null}

          {d.kind === 'brief' ? (
            <div className="cpost">
              <div className="ch"><b>The brief</b></div>
              <div className="cb">
                <div className="ct">{d.brief}</div>
                <div className="cap" style={{ marginTop: 18 }}>
                  <div className="cl">What counts as done</div>
                  <div className="ct">{d.acceptance || 'Not written. Ask before you start.'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {d.driveLink ? <a className="cbtn" href={d.driveLink} target="_blank" rel="noreferrer">The files in Drive</a> : null}
                  {d.docLink ? <a className="cbtn" href={d.docLink} target="_blank" rel="noreferrer">The document</a> : null}
                </div>
              </div>
            </div>) : null}

          {d.kind === 'callsheet' && cs ? (
            <>
              <div className="cpost">
                <div className="ch"><b>{dayOf(cs.date)}</b><span>{cs.callTime ? 'Call ' + cs.callTime : ''}{cs.wrapTime ? ' · wrap ' + cs.wrapTime : ''}</span></div>
                <div className="cb">
                  <div className="cap"><div className="cl">Where</div>
                    <div className="ct">{cs.location || 'Not stated'}</div>
                    {cs.mapLink ? <a className="cbtn" style={{ marginTop: 8, display: 'inline-block' }} href={cs.mapLink} target="_blank" rel="noreferrer">Open the map</a> : null}
                  </div>
                  {(cs.contacts || []).length ? (
                    <div className="cap"><div className="cl">Who to call</div>
                      {(cs.contacts || []).map((c, i) => (
                        <div className="ct" key={i}>{c.name}{c.role ? ', ' + c.role : ''}{c.phone ? ' · ' + c.phone : ''}</div>))}
                    </div>) : null}
                  {(cs.schedule || []).length ? (
                    <div className="cap"><div className="cl">Running order</div>
                      {(cs.schedule || []).map((s, i) => (
                        <div className="ct" key={i}><b>{s.time}</b>{s.time ? ' · ' : ''}{s.what}</div>))}
                    </div>) : null}
                  {cs.kit ? <div className="cap"><div className="cl">Kit</div><div className="ct">{cs.kit}</div></div> : null}
                  {cs.notes ? <div className="cap"><div className="cl">Anything else</div><div className="ct">{cs.notes}</div></div> : null}
                </div>
              </div>
            </>) : null}

          {d.kind === 'callsheet' && !cs ? <div className="alert">The call sheet has not been filled in yet.</div> : null}

          <div className="cpost">
            <div className="ch"><b>Your reply</b><span>{(d.responses || []).length ? (d.responses || []).length + ' so far' : ''}</span></div>
            <div className="cb">
              {(d.responses || []).map((r, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 7, color: 'var(--muted)' }}>
                  <b>{r.by}</b> {r.kind === 'accepted' ? 'took the job' : r.kind === 'declined' ? 'turned it down' : 'asked'}
                  {r.text ? ': ' + r.text : ''} <span style={{ color: 'var(--faint)' }}>{when(r.at)}</span>
                </div>))}

              {sent ? (
                <div className="guard">
                  {sent === 'accepted' ? 'Thank you, that is recorded. Everything you need is on this page.'
                    : sent === 'declined' ? 'Understood, that is recorded and someone will pick it up.'
                    : 'Sent. Your question is now on the job for the team to answer.'}
                </div>) : (
                <>
                  <input className="inp" style={{ marginBottom: 8 }} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                  <textarea className="inp" placeholder="A question, or anything you need before you start" value={text} onChange={(e) => setText(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                    <button className="cbtn go" disabled={busy} onClick={() => reply('accepted')}>I have got this</button>
                    <button className="cbtn ch" disabled={busy} onClick={() => reply('question')}>Ask a question</button>
                    <button className="cbtn" disabled={busy} onClick={() => reply('declined')}>I cannot take it</button>
                  </div>
                </>)}
            </div>
          </div>

          <p className="note" style={{ marginTop: 22 }}>
            You do not need an account for this. Anything you send here lands on the job itself, so it is
            not sitting in one person's messages.
          </p>
        </>) : null}
    </div>
  );
}
