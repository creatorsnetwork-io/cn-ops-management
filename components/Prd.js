'use client';
import { useState } from 'react';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function Prd({ slug, initial, comments, rights }) {
  const [text, setText] = useState(initial || '');
  const [list, setList] = useState(comments || []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const canEdit = rights === 'yes';
  const canComment = ['yes', 'comment'].includes(rights);

  async function post(body) {
    setBusy(body.action); setErr(''); setMsg('');
    const r = await fetch('/api/prd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, ...body }) });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return null; }
    return j;
  }

  const open = list.filter((c) => !c.resolved);

  return (
    <>
      <div className="panel">
        <header>
          <h2>The working document</h2>
          {canEdit
            ? <button className="btn sm dark" disabled={busy === 'save'} onClick={async () => { const j = await post({ action: 'save', prd: text }); if (j) setMsg('Saved.'); }}>{busy === 'save' ? 'Saving' : 'Save'}</button>
            : <span className="pill">{rights === 'comment' ? 'you can comment, not rewrite' : 'view only'}</span>}
        </header>
        <div style={{ padding: '14px 16px' }}>
          {canEdit ? (
            <textarea className="inp" style={{ minHeight: 340, lineHeight: 1.62 }} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="What this project is, what has been decided, what is still open, and what everyone should stop asking about." />
          ) : text ? (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
          ) : <p style={{ color: 'var(--faint)', fontSize: 13 }}>Nothing written yet.</p>}
          {msg ? <div style={{ marginTop: 9, fontSize: 13, color: 'var(--ok)' }}>{msg}</div> : null}
          {err ? <div style={{ marginTop: 9, fontSize: 13, color: 'var(--bad)' }}>{err}</div> : null}
        </div>
      </div>

      <div className="panel">
        <header><h2>Comments</h2><span className="pill">{open.length} open</span></header>
        {list.length === 0 ? <div className="empty">No comments.</div> : null}
        {list.map((c) => (
          <div className="row" key={c._key}>
            <span className={'dot ' + (c.resolved ? 'ok' : 'no')} />
            <div className="t">
              <b>{c.by}</b>
              <span>{c.text}</span>
              <span style={{ color: 'var(--faint)' }}>{when(c.at)}{c.resolved ? ', closed by ' + c.resolvedBy : ''}</span>
            </div>
            {canEdit && !c.resolved
              ? <button className="btn sm" onClick={async () => { const j = await post({ action: 'resolve', key: c._key }); if (j) setList(list.map((x) => (x._key === c._key ? { ...x, resolved: true, resolvedBy: 'you' } : x))); }}>Close</button>
              : null}
          </div>))}
        {canComment ? (
          <div style={{ padding: '13px 16px', borderTop: '1px solid var(--line2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="inp" style={{ flex: 1, minWidth: 260 }} value={note} placeholder="What needs saying about this document" onChange={(e) => setNote(e.target.value)} />
            <button className="btn dark" disabled={busy === 'comment'} onClick={async () => {
              const j = await post({ action: 'comment', text: note });
              if (j) { setList(list.concat([{ _key: 'tmp' + Date.now(), by: 'you', at: new Date().toISOString(), text: note, resolved: false }])); setNote(''); }
            }}>Add it</button>
          </div>) : null}
      </div>
    </>
  );
}
