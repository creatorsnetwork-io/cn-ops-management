'use client';
import { useState } from 'react';
import { can } from '../lib/perm';

// Drafting and, separately, writing into the sheet. The two are deliberately
// different buttons: a draft costs nothing, a write changes a client's calendar.
export default function DraftPanel({ slug, week, item, who, onWritten }) {
  const rights = can(who, 'generate');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [conflict, setConflict] = useState(null);

  if (rights === 'no') return null;

  const empty = (item.captions || []).filter((c) => !c.has);
  const filled = (item.captions || []).filter((c) => c.has);

  async function draft(onlyEmpty) {
    setBusy('draft'); setErr(''); setMsg('');
    const r = await fetch('/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'captions', slug, week, key: item.key, onlyEmpty }),
    });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    const next = { ...drafts };
    for (const d of j.drafts) next[d.channel] = { id: d._id, text: d.text };
    setDrafts(next);
    setMsg('Drafted by ' + j.model + '. Nothing has been written to the sheet.');
    if (j.warning) setErr(j.warning);
  }

  async function write(channel, mode) {
    const d = drafts[channel];
    if (!d) return;
    setBusy(channel); setErr(''); setMsg('');
    const r = await fetch('/api/push', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, week, key: item.key, channel, text: d.text, draftId: d.id, mode }),
    });
    const j = await r.json(); setBusy('');
    if (j.ok) {
      setMsg('Written into ' + j.cell + (j.replaced ? '. The old text is saved in the log.' : '.'));
      setConflict(null);
      const n = { ...drafts }; delete n[channel]; setDrafts(n);
      if (onWritten) onWritten();
      return;
    }
    if (j.needsReplace) { setConflict({ channel, existing: j.existing }); setErr(j.error); return; }
    setErr(j.error);
  }

  function edit(channel, text) { setDrafts({ ...drafts, [channel]: { ...drafts[channel], text } }); }

  return (
    <div style={{ marginTop: 14, paddingTop: 13, borderTop: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        {empty.length ? (
          <button className="btn sm dark" disabled={busy === 'draft'} onClick={() => draft(true)}>
            {busy === 'draft' ? 'Drafting' : '✦ Draft the ' + empty.length + ' missing caption' + (empty.length === 1 ? '' : 's')}
          </button>) : null}
        {filled.length ? (
          <button className="btn sm" disabled={busy === 'draft'} onClick={() => draft(false)}>
            {'✦ Redraft everything'}
          </button>) : null}
        {rights !== 'yes' ? <span className="pill">{rights}</span> : null}
        {msg ? <span style={{ fontSize: 12.5, color: 'var(--ok)' }}>{msg}</span> : null}
        {err ? <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</span> : null}
      </div>

      {Object.keys(drafts).map((ch) => (
        <div key={ch} style={{ marginTop: 11, border: '1px solid var(--line)', borderRadius: 9, background: '#fff' }}>
          <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--line2)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12.5 }}>{ch}, draft</b>
            <span style={{ display: 'flex', gap: 5 }}>
              <button className="btn sm" onClick={() => navigator.clipboard.writeText(drafts[ch].text)}>Copy</button>
              <button className="btn sm dark" disabled={busy === ch} onClick={() => write(ch, 'fill')}>
                {busy === ch ? 'Writing' : 'Write it into the sheet'}
              </button>
              <button className="btn sm" onClick={() => { const n = { ...drafts }; delete n[ch]; setDrafts(n); }}>Bin it</button>
            </span>
          </div>
          <textarea className="inp" style={{ border: 'none', minHeight: 120, borderRadius: 0 }}
            value={drafts[ch].text} onChange={(e) => edit(ch, e.target.value)} />
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line2)', fontSize: 11.5, color: 'var(--faint)' }}>
            {drafts[ch].text.length} characters. Edit it here before writing, the sheet gets exactly what you see.
          </div>
        </div>))}

      {conflict ? (
        <div className="panel" style={{ marginTop: 11 }}>
          <header><h2>That cell is not empty</h2><span className="tag warn">nothing written yet</span></header>
          <div style={{ padding: '13px 16px' }}>
            <div className="k">What is in the sheet right now</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, background: 'var(--head)', border: '1px solid var(--line2)', borderRadius: 7, padding: '9px 11px', marginTop: 5 }}>
              {conflict.existing}
            </div>
            <p className="note" style={{ marginTop: 9 }}>
              Replacing saves the text above first, so it can be recovered from the log. The write is
              recorded against your name either way.
            </p>
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button className="btn dark" disabled={busy === conflict.channel} onClick={() => write(conflict.channel, 'replace')}>
                Replace it anyway
              </button>
              <button className="btn" onClick={() => { setConflict(null); setErr(''); }}>Leave it alone</button>
            </div>
          </div>
        </div>) : null}
    </div>
  );
}
