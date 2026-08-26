'use client';
import { useState } from 'react';
import Link from 'next/link';
import { LABEL, TAG, KINDS, STATES, verbsFor, isLate, canAssign } from '../lib/work';
import Raise from './Raise';
import ShareWork from './ShareWork';
import { can as canDo } from '../lib/perm';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '');

export default function WorkItem({ initial, who, people, vendors, leadName, canEdit }) {
  const [i, setI] = useState(initial);
  const [v, setV] = useState(null);
  const [note, setNote] = useState('');
  const [link, setLink] = useState(initial.driveLink || '');
  const [clientName, setClientName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);

  const verbs = verbsFor(i, who);

  async function go(verb) {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'move', id: i._id, verb, note, link, clientName }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setI(j.item); setV(null); setNote(''); setClientName(''); }
    else setErr(j.error);
  }

  async function saveEdit() {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'edit', id: i._id, ...edit }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setI(j.item); setEdit(null); } else setErr(j.error);
  }

  async function fbDone(key) {
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'feedbackDone', id: i._id, key }),
    });
    const j = await r.json();
    if (j.ok) setI(j.item); else setErr(j.error);
  }

  const openFb = (i.feedback || []).filter((f) => !f.resolved);
  const ch = canAssign(i, who);
  const givableTo = ch.list === null ? people : people.filter((p) => (ch.list || []).includes(p.slug));

  async function saveAssign(slug, due) {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'assign', id: i._id, assignee: slug, due }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) setI(j.item); else setErr(j.error);
  }

  // Vendor is record keeping only, kept separate from assignee so it never
  // touches who is internally accountable for moving the item along.
  async function saveVendor(vendorId) {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'assign', id: i._id, vendorId }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) setI(j.item); else setErr(j.error);
  }

  return (
    <>
      <div className="eyebrow">{i.client}, {i.projectName}</div>
      <h1>{i.title}</h1>
      <p className="lede">
        {KINDS[i.kind]?.label || i.kind}. {i.assigneeName ? 'With ' + i.assigneeName : 'Nobody assigned'}.
        {i.vendorName ? ' Vendor: ' + i.vendorName + '.' : ''}
        {i.due ? ' Due ' + dayOf(i.due) + '.' : ' No date set.'}
        {isLate(i) ? ' This is late.' : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATES.map((s) => (
          <span key={s} className={'tag ' + (s === i.state ? (TAG[s] || 'info') : 'mute')}
            style={{ opacity: s === i.state ? 1 : 0.45 }}>{LABEL[s]}</span>))}
      </div>

      {openFb.length ? (
        <div className="panel">
          <header><h2>Changes asked for</h2><span className="tag bad">{openFb.length} open</span></header>
          {openFb.map((f) => (
            <div className="row" key={f._key}>
              <span className="dot no" />
              <div className="t"><b>{f.who === 'client' ? 'The client' : f.who}</b><span>{f.text}</span>
                <span style={{ color: 'var(--faint)' }}>{when(f.at)}</span></div>
              <button className="btn sm" onClick={() => fbDone(f._key)}>Handled</button>
            </div>))}
        </div>) : null}

      <div className="panel">
        <header>
          <h2>What can happen next</h2>
          <span className="pill">you are {who}</span>
        </header>
        {verbs.length === 0 ? <div className="empty">Nothing moves from {LABEL[i.state]}. This item is finished.</div> : null}
        {verbs.map((vb) => (
          <div className="row" key={vb.name}>
            <span className={'dot ' + (vb.ok ? 'ok' : 'no')} />
            <div className="t"><b>{vb.label}</b>
              <span>{vb.ok ? 'Moves this to ' + LABEL[vb.to] + '.' : vb.why}</span></div>
            {vb.ok ? <button className="btn sm dark" onClick={() => { setV(vb); setErr(''); }}>{vb.label}</button> : null}
          </div>))}

        {v ? (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)', background: '#FCFDFE' }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 9 }}>{v.label}</div>
            {v.needLink ? (
              <label style={{ display: 'block', marginBottom: 9 }}>
                <div className="k">Drive link to what you produced</div>
                <input className="inp" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste the Google Drive link" />
              </label>) : null}
            {v.needWho ? (
              <label style={{ display: 'block', marginBottom: 9 }}>
                <div className="k">Who at the client approved it</div>
                <input className="inp" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Name and how they said it" />
              </label>) : null}
            <label style={{ display: 'block' }}>
              <div className="k">{v.needNote ? 'What needs changing' : 'Anything worth recording'}</div>
              <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {err ? <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 7 }}>{err}</div> : null}
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button className="btn dark" disabled={busy} onClick={() => go(v.name)}>{busy ? 'Saving' : 'Confirm'}</button>
              <button className="btn" onClick={() => { setV(null); setErr(''); }}>Cancel</button>
            </div>
          </div>) : null}
      </div>

      {!canEdit ? (
        <div className="panel">
          <header><h2>Who is doing it</h2>{!ch.ok ? <span className="pill">not yours to move</span> : null}</header>
          {!ch.ok ? <div style={{ padding: '13px 16px', fontSize: 13, color: 'var(--muted)' }}>{ch.why}</div> : (
            <div style={{ padding: '13px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label><div className="k">Give it to</div>
                <select className="inp" style={{ width: 'auto' }} value={i.assignee || ''}
                  onChange={(e) => saveAssign(e.target.value, i.due || '')} disabled={busy}>
                  <option value="">Nobody yet</option>
                  {givableTo.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="k">Due</div>
                <input className="inp" style={{ width: 'auto' }} type="date" value={i.due || ''}
                  onChange={(e) => saveAssign(i.assignee || '', e.target.value)} disabled={busy} /></label>
              <label><div className="k">Vendor or freelancer</div>
                <select className="inp" style={{ width: 'auto' }} value={i.vendorId || ''}
                  onChange={(e) => saveVendor(e.target.value)} disabled={busy}>
                  <option value="">None</option>
                  {(vendors || []).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select></label>
              {err ? <span style={{ color: 'var(--bad)', fontSize: 12.5 }}>{err}</span> : null}
            </div>)}
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            You can hand this to your own people and change the date. Rewriting the brief stays with
            Himanshu and Aashif, so a piece of work cannot quietly turn into something else.
          </div>
        </div>) : null}

      <div className="panel">
        <header>
          <h2>The brief</h2>
          {canEdit ? (edit
            ? <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm dark" disabled={busy} onClick={saveEdit}>Save</button>
                <button className="btn sm" onClick={() => setEdit(null)}>Cancel</button></span>
            : <button className="btn sm" onClick={() => setEdit({ title: i.title, brief: i.brief || '', acceptance: i.acceptance || '', due: i.due || '', assignee: i.assignee || '', vendorId: i.vendorId || '', driveLink: i.driveLink || '', docLink: i.docLink || '' })}>Edit</button>) : null}
        </header>
        {edit ? (
          <div style={{ padding: '14px 16px', display: 'grid', gap: 11 }}>
            <label><div className="k">Title</div><input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <label><div className="k">Who is doing it</div>
                <select className="inp" value={edit.assignee} onChange={(e) => setEdit({ ...edit, assignee: e.target.value })}>
                  <option value="">Nobody yet</option>
                  {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select></label>
              <label><div className="k">Due</div><input className="inp" type="date" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} /></label>
              <label><div className="k">Vendor or freelancer</div>
                <select className="inp" value={edit.vendorId} onChange={(e) => setEdit({ ...edit, vendorId: e.target.value })}>
                  <option value="">None</option>
                  {(vendors || []).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select></label>
            </div>
            <label><div className="k">Brief</div><textarea className="inp" style={{ minHeight: 120 }} value={edit.brief} onChange={(e) => setEdit({ ...edit, brief: e.target.value })} /></label>
            <label><div className="k">What counts as done</div><input className="inp" value={edit.acceptance} onChange={(e) => setEdit({ ...edit, acceptance: e.target.value })} /></label>
            <label><div className="k">Drive link</div><input className="inp mono" value={edit.driveLink} onChange={(e) => setEdit({ ...edit, driveLink: e.target.value })} /></label>
            <label><div className="k">Doc link</div><input className="inp mono" value={edit.docLink} onChange={(e) => setEdit({ ...edit, docLink: e.target.value })} /></label>
          </div>
        ) : (
          <div style={{ padding: '14px 16px' }}>
            {i.brief ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{i.brief}</div>
              : <p style={{ color: 'var(--faint)', fontSize: 13 }}>No brief written. That is usually why it comes back.</p>}
            <div style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line2)' }}>
              <div className="k">What counts as done</div>
              <div style={{ fontSize: 13.5, marginTop: 4 }}>{i.acceptance || <span style={{ color: 'var(--faint)' }}>Not defined, so nobody can be wrong about it either way.</span>}</div>
            </div>
            <div style={{ marginTop: 13, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
              {i.driveLink ? <a href={i.driveLink} target="_blank" rel="noreferrer">The files in Drive</a> : <span style={{ color: 'var(--faint)' }}>No Drive link yet</span>}
              {i.docLink ? <a href={i.docLink} target="_blank" rel="noreferrer">The document</a> : null}
              <Link href={'/projects/' + i.projectSlug}>The project</Link>
            </div>
          </div>)}
      </div>

      <ShareWork item={i} canShare={canDo(who, 'shareClientLink') !== 'no' || ['himanshu', 'aashif'].includes(who)} />

      <Raise leadName={leadName} workId={i._id} projectSlug={i.projectSlug}
        context={i.title} label="I need a decision on this" />

      <div className="panel">
        <header><h2>Everything that happened</h2><span className="pill">{(i.history || []).length} step{(i.history || []).length === 1 ? '' : 's'}</span></header>
        {(i.history || []).slice().reverse().map((h) => (
          <div className="row" key={h._key}>
            <span className="dot ok" />
            <div className="t">
              <b>{h.from ? LABEL[h.from] + ' to ' + LABEL[h.to] : 'Briefed'}</b>
              <span>{h.who}{h.clientName ? ', approved by ' + h.clientName : ''} · {when(h.at)}</span>
              {h.note ? <span style={{ color: 'var(--ink)' }}>{h.note}</span> : null}
            </div>
          </div>))}
      </div>
    </>
  );
}
