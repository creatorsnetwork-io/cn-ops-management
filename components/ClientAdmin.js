'use client';
import { useState } from 'react';
import Link from 'next/link';

const blank = () => ({ _key: 'new' + Math.floor(Math.random() * 1e9), name: '', role: '', email: '', phone: '', canApprove: false });

export default function ClientAdmin({ c, canEdit }) {
  const [contacts, setContacts] = useState(c.contacts || []);
  const [note, setNote] = useState(c.note || '');
  const [drive, setDrive] = useState(c.driveFolderId || '');
  const [logo, setLogo] = useState(c.logoUrl || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function post(body) {
    setBusy(body.action); setErr(''); setMsg('');
    const r = await fetch('/api/client-admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: c.slug, ...body }) });
    const j = await r.json(); setBusy('');
    if (j.ok) setMsg('Saved.'); else setErr(j.error);
  }

  async function upload() {
    if (!file) { setErr('Pick a file first.'); return; }
    setBusy('logo'); setErr(''); setMsg('');
    const fd = new FormData(); fd.append('slug', c.slug); fd.append('file', file);
    const r = await fetch('/api/client-admin', { method: 'POST', body: fd });
    const j = await r.json(); setBusy('');
    if (j.ok) { setLogo(j.url); setMsg('Logo saved.'); } else setErr(j.error);
  }

  function set(i, k, v) { setContacts(contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x))); }
  const approvers = contacts.filter((x) => x.canApprove).length;

  return (
    <>
      <div className="panel">
        <header>
          <h2>The client</h2>
          {canEdit ? <button className="btn sm dark" disabled={busy === 'edit'} onClick={() => post({ action: 'edit', note, driveFolderId: drive })}>Save</button> : <span className="pill">view only</span>}
        </header>
        <div style={{ padding: '14px 16px', display: 'grid', gap: 13 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div className="k">Logo</div>
              <div style={{ width: 150, height: 76, border: '1px solid var(--line)', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5, overflow: 'hidden' }}>
                {logo ? <img src={logo} alt={c.name} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 12, color: 'var(--faint)' }}>none</span>}
              </div>
              {canEdit ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                  <input type="file" accept="image/*" style={{ fontSize: 12, width: 150 }} onChange={(e) => setFile(e.target.files[0])} />
                  <button className="btn sm" disabled={busy === 'logo'} onClick={upload}>{busy === 'logo' ? 'Uploading' : 'Upload'}</button>
                </div>) : null}
            </div>
            <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 11 }}>
              <label><div className="k">Drive folder ID</div>
                <input className="inp mono" value={drive} disabled={!canEdit} onChange={(e) => setDrive(e.target.value)} /></label>
              <label><div className="k">Anything the team should know</div>
                <textarea className="inp" value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} /></label>
            </div>
          </div>
          {msg ? <div style={{ fontSize: 13, color: 'var(--ok)' }}>{msg}</div> : null}
          {err ? <div style={{ fontSize: 13, color: 'var(--bad)' }}>{err}</div> : null}
        </div>
      </div>

      <div className="panel">
        <header>
          <h2>Who we deal with</h2>
          {canEdit ? <span style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={() => setContacts([...contacts, blank()])}>Add someone</button>
            <button className="btn sm dark" disabled={busy === 'contacts'} onClick={() => post({ action: 'contacts', contacts })}>Save</button>
          </span> : <span className="pill">{approvers} can approve</span>}
        </header>
        <table className="tbl">
          <thead><tr><th>Name</th><th style={{ width: 140 }}>Role</th><th style={{ width: 190 }}>Email</th><th style={{ width: 130 }}>Phone</th><th style={{ width: 110 }}>Can approve</th>{canEdit ? <th style={{ width: 60 }} /> : null}</tr></thead>
          <tbody>
            {contacts.map((x, i) => (
              <tr key={x._key || i}>
                <td><input className="inp" value={x.name} disabled={!canEdit} onChange={(e) => set(i, 'name', e.target.value)} /></td>
                <td><input className="inp" value={x.role} disabled={!canEdit} onChange={(e) => set(i, 'role', e.target.value)} /></td>
                <td><input className="inp" value={x.email} disabled={!canEdit} onChange={(e) => set(i, 'email', e.target.value)} /></td>
                <td><input className="inp" value={x.phone} disabled={!canEdit} onChange={(e) => set(i, 'phone', e.target.value)} /></td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!x.canApprove} disabled={!canEdit} onChange={(e) => set(i, 'canApprove', e.target.checked)} /></td>
                {canEdit ? <td><button className="btn link" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>Drop</button></td> : null}
              </tr>))}
            {contacts.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="empty">
              Nobody recorded. Marking who can approve stops "the client said yes" meaning three different people.
            </td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <header><h2>Projects</h2></header>
        <table className="tbl">
          <thead><tr><th>Project</th><th style={{ width: 160 }}>Type</th><th style={{ width: 120 }}>Tracked</th></tr></thead>
          <tbody>
            {(c.projects || []).map((p) => (
              <tr key={p.slug}><td><Link href={'/projects/' + p.slug}>{p.name}</Link></td><td>{p.type}</td><td>{p.cadence}</td></tr>))}
            {(c.projects || []).length === 0 ? <tr><td colSpan={3} className="empty">No projects.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
