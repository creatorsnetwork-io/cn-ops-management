'use client';
import { useState } from 'react';
import Link from 'next/link';

const TYPE = { social: 'Social retainer', website: 'Website', seo: 'SEO', influencer: 'Influencer', video: 'Film or shoot', aiVideo: 'AI video', events: 'Event' };
const pct = (a, b) => (!b ? 0 : Math.min(100, Math.round((a / b) * 100)));
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const when = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
const today = () => new Date().toISOString().slice(0, 10);

// This is CN's own agreement, not data. It is on the screen so nobody has to
// remember it or ask, which was the whole point of writing it down.
const RIGHTS = [
  ['Routine delivery', 'Aashif signs that it shipped'],
  ['Brand content', 'Priyanka approves'],
  ['Creative craft', 'Shelly approves all creatives'],
  ['First of its kind', 'Himanshu once, by exception, with somebody shadowing'],
  ['Quality against a date', 'Quality wins, the date moves, the client is told the same day'],
  ['The baseline', 'Himanshu and Aashif edit it, everyone else asks'],
];

export default function ClientDetail({ c, onb, canEdit, links }) {
  const [tab, setTab] = useState('setup');
  const [contacts, setContacts] = useState(c.contacts || []);
  const [ob, setOb] = useState(c.obligations || []);
  const [f, setF] = useState({
    note: c.note || '', driveFolderId: c.driveFolderId || '',
    channel: c.channel || '', turnaround: c.turnaround || '', renewal: c.renewal || '',
  });
  const [logo, setLogo] = useState(c.logoUrl || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function post(body) {
    setBusy(body.action); setErr(''); setMsg('');
    const r = await fetch('/api/client-admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: c.slug, ...body }) }).then((x) => x.json());
    setBusy('');
    if (r.ok) { setMsg('Saved.'); setTimeout(() => setMsg(''), 1800); } else setErr(r.error);
    return r;
  }

  async function upload() {
    if (!file) { setErr('Pick a file first.'); return; }
    setBusy('logo'); setErr('');
    const fd = new FormData(); fd.append('slug', c.slug); fd.append('file', file);
    const r = await fetch('/api/client-admin', { method: 'POST', body: fd }).then((x) => x.json());
    setBusy('');
    if (r.ok) { setLogo(r.url); setMsg('Logo saved.'); } else setErr(r.error);
  }

  async function tick(i, on) {
    const r = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: c.slug, step: i, on }) }).then((x) => x.json());
    if (r.ok) window.location.reload(); else setErr(r.error);
  }

  const blocked = onb.done.map((d, i) => (d ? null : onb.unlocks[i])).filter(Boolean);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow n">Client</div>
          <h1>{c.name}</h1>
          <p className="lede">
            Everything the relationship owns sits here. Everything an engagement owns sits in a project.
          </p>
        </div>
        <div className="rowb">
          {c.driveFolderId ? <a className="btn" target="_blank" rel="noreferrer" href={'https://drive.google.com/drive/folders/' + c.driveFolderId}>Drive</a> : null}
          <Link className="btn" href="/clients">All clients</Link>
        </div>
      </div>

      {onb.count < 9 ? (
        <div className="callout">
          <span>
            <b>Setup {onb.count} of 9.</b>{' '}
            {blocked.length ? 'Not yet available: ' + blocked.join(', ') + '.' : 'Nearly there.'}
          </span>
          <button className="btn" onClick={() => setTab('setup')}>Open the setup</button>
        </div>) : null}

      <div className="tabs">
        {[['setup', 'Setup ' + onb.count + ' of 9'], ['working', 'Working setup'], ['people', 'Who we deal with'], ['obligations', 'Obligations']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>))}
      </div>

      <div className="grid2">
        <div>
          <div className="panel">
            <header>
              <div><h2>Projects</h2><div className="sub2">Contracts, calendars and deliverables live here, not on the client.</div></div>
            </header>
            <table className="tbl">
              <thead><tr><th>Project</th><th style={{ width: 150 }}>Service</th><th style={{ width: 100 }}>Owner</th><th style={{ width: 150 }}>Approved</th></tr></thead>
              <tbody>
                {(c.projects || []).map((p) => (
                  <tr key={p.slug}>
                    <td className="b"><Link href={'/projects/' + p.slug}>{p.name}</Link></td>
                    <td className="dim">{TYPE[p.type] || p.type}</td>
                    <td className="dim">{p.owner || '—'}</td>
                    <td className="dim">{p.approved} of {p.target || '?'}
                      <div className="bar2" style={{ marginTop: 4 }}><i style={{ width: pct(p.approved, p.target) + '%' }} /></div></td>
                  </tr>))}
                {(c.projects || []).length === 0 ? <tr><td colSpan={4} className="empty">No projects yet.</td></tr> : null}
              </tbody>
            </table>
          </div>

          {tab === 'setup' ? (
            <div className="panel">
              <header>
                <div><h2>Setup</h2><div className="sub2">Most of these tick themselves. Do the thing and it goes green.</div></div>
                <span className={'tag ' + (onb.count >= 9 ? 'ok' : 'warn')}>{onb.count} of 9</span>
              </header>
              {onb.steps.map((t, i) => (
                <div className={'chk ' + (onb.done[i] ? 'done' : '')} key={i}>
                  <div className="box">{onb.done[i] ? '✓' : ''}</div>
                  <div className="tx">
                    <b>{t}</b>
                    <span>{onb.why[i]}{onb.unlocks[i] ? ' Unlocks: ' + onb.unlocks[i] + '.' : ''}</span>
                  </div>
                  {onb.done[i]
                    ? (onb.byHand.includes(i) && onb.manual[String(i)] && canEdit
                        ? <button className="btn sm" onClick={() => tick(i, false)}>Reopen</button>
                        : <span className="tag ok">Done</span>)
                    : (onb.byHand.includes(i) && canEdit
                        ? <button className="btn sm dark" onClick={() => tick(i, true)}>Sign it off</button>
                        : <span className="tag mute">Waiting on the work</span>)}
                </div>))}
              <div style={{ padding: '11px 15px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
                These are not hard gates yet. They tell you what is missing and what it costs. Turning
                them into blocks before the setups are filled in would lock the team out of their own work.
              </div>
            </div>) : null}

          {tab === 'obligations' ? (
            <div className="panel">
              <header>
                <h2>Obligations</h2>
                {canEdit ? <span className="rowb">
                  <button className="btn sm" onClick={() => setOb([...ob, { _key: 'n' + Math.random(), name: '', due: '', owner: '', every: 'month' }])}>Add one</button>
                  <button className="btn sm dark" disabled={busy === 'obligations'} onClick={() => post({ action: 'obligations', obligations: ob })}>Save</button>
                </span> : null}
              </header>
              <table className="tbl">
                <thead><tr><th>What</th><th style={{ width: 130 }}>Next due</th><th style={{ width: 110 }}>Owner</th><th style={{ width: 110 }}>Every</th><th style={{ width: 120 }} /></tr></thead>
                <tbody>
                  {ob.map((x, i) => (
                    <tr key={x._key || i}>
                      <td><input className="inp" value={x.name} disabled={!canEdit} onChange={(e) => setOb(ob.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} /></td>
                      <td><input className="inp" type="date" value={x.due || ''} disabled={!canEdit} onChange={(e) => setOb(ob.map((y, j) => (j === i ? { ...y, due: e.target.value } : y)))} />
                        {x.due && x.due < today() ? <div><span className="tag bad">overdue</span></div> : null}</td>
                      <td><input className="inp" value={x.owner} disabled={!canEdit} onChange={(e) => setOb(ob.map((y, j) => (j === i ? { ...y, owner: e.target.value } : y)))} /></td>
                      <td>
                        <select className="inp" value={x.every} disabled={!canEdit} onChange={(e) => setOb(ob.map((y, j) => (j === i ? { ...y, every: e.target.value } : y)))}>
                          <option value="month">month</option><option value="quarter">quarter</option>
                          <option value="year">year</option><option value="once">once</option>
                        </select></td>
                      <td>
                        {x._key && !String(x._key).startsWith('n0.') && canEdit
                          ? <button className="btn sm" onClick={async () => { await post({ action: 'obligationDone', key: x._key }); window.location.reload(); }}>Mark done</button>
                          : null}
                        {x.doneAt ? <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>last {when(x.doneAt)}</div> : null}
                      </td>
                    </tr>))}
                  {ob.length === 0 ? <tr><td colSpan={5} className="empty">
                    Nothing recorded. Monthly report, invoice, renewal conversation and domain renewal are the usual four.
                  </td></tr> : null}
                </tbody>
              </table>
              <div style={{ padding: '11px 15px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
                Marking one done rolls its date forward by its own interval, so a recurring job never
                needs re-typing.
              </div>
            </div>) : null}

          {tab === 'people' ? (
            <div className="panel">
              <header>
                <h2>Who we deal with</h2>
                {canEdit ? <span className="rowb">
                  <button className="btn sm" onClick={() => setContacts([...contacts, { _key: 'n' + Math.random(), name: '', role: '', email: '', phone: '', canApprove: false }])}>Add someone</button>
                  <button className="btn sm dark" disabled={busy === 'contacts'} onClick={() => post({ action: 'contacts', contacts })}>Save</button>
                </span> : <span className="pill">{contacts.filter((x) => x.canApprove).length} can approve</span>}
              </header>
              <table className="tbl">
                <thead><tr><th>Name</th><th style={{ width: 130 }}>Role</th><th style={{ width: 180 }}>Email</th><th style={{ width: 120 }}>Phone</th><th style={{ width: 100 }}>Approves</th>{canEdit ? <th style={{ width: 60 }} /> : null}</tr></thead>
                <tbody>
                  {contacts.map((x, i) => (
                    <tr key={x._key || i}>
                      {['name', 'role', 'email', 'phone'].map((k) => (
                        <td key={k}><input className="inp" value={x[k] || ''} disabled={!canEdit}
                          onChange={(e) => setContacts(contacts.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)))} /></td>))}
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!x.canApprove} disabled={!canEdit}
                        onChange={(e) => setContacts(contacts.map((y, j) => (j === i ? { ...y, canApprove: e.target.checked } : y)))} /></td>
                      {canEdit ? <td><button className="btn link" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>Drop</button></td> : null}
                    </tr>))}
                  {contacts.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="empty">
                    Nobody recorded. Marking who can approve stops "the client said yes" meaning three different people.
                  </td></tr> : null}
                </tbody>
              </table>
            </div>) : null}

          {tab === 'working' ? (
            <div className="panel">
              <header>
                <h2>Working setup</h2>
                {canEdit ? <button className="btn sm dark" disabled={busy === 'edit'} onClick={() => post({ action: 'edit', ...f })}>Save</button> : null}
              </header>
              <div className="pad" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div className="lbl">Logo</div>
                    <div style={{ width: 150, height: 74, border: '1px solid var(--line)', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5, overflow: 'hidden' }}>
                      {logo ? <img src={logo} alt="" style={{ maxWidth: '88%', maxHeight: '78%', objectFit: 'contain' }} /> : <span className="dim" style={{ fontSize: 12 }}>none</span>}
                    </div>
                    {canEdit ? <div className="rowb" style={{ marginTop: 7 }}>
                      <input type="file" accept="image/*" style={{ fontSize: 12, width: 148 }} onChange={(e) => setFile(e.target.files[0])} />
                      <button className="btn sm" disabled={busy === 'logo'} onClick={upload}>{busy === 'logo' ? 'Uploading' : 'Upload'}</button>
                    </div> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 250, display: 'grid', gap: 10 }}>
                    {[['channel', 'How they approve', 'WhatsApp group, email, a call'],
                      ['turnaround', 'Turnaround they expect', '48 hours on captions'],
                      ['renewal', 'Renewal', '31 Dec 2026'],
                      ['driveFolderId', 'Drive folder ID', '']].map(([k, label, ph]) => (
                      <label key={k}><div className="lbl">{label}</div>
                        <input className={'inp' + (k === 'driveFolderId' ? ' mono' : '')} value={f[k]} disabled={!canEdit} placeholder={ph}
                          onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>))}
                  </div>
                </div>
                <label><div className="lbl">Anything the team should know</div>
                  <textarea className="inp" value={f.note} disabled={!canEdit} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
              </div>
              <table className="tbl">
                <tbody>
                  <tr><td className="dim" style={{ width: 180 }}>Approvers named</td><td className="b">{contacts.filter((x) => x.canApprove).map((x) => x.name).join(', ') || 'nobody yet'}</td></tr>
                  <tr><td className="dim">Review links issued</td><td className="b">{links} <Link href="/links" style={{ fontWeight: 400 }}>view them</Link></td></tr>
                </tbody>
              </table>
            </div>) : null}

          {msg ? <div className="guard">{msg}</div> : null}
          {err ? <div className="alert">{err}</div> : null}
        </div>

        <div>
          <div className="panel">
            <header><div><h2>Decision rights</h2><div className="sub2">The agreement, so nobody has to ask.</div></div></header>
            <table className="tbl">
              <tbody>
                {RIGHTS.map(([a, b]) => (
                  <tr key={a}><td className="b" style={{ width: 150 }}>{a}</td><td className="dim">{b}</td></tr>))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <header><h2>Needs looking at</h2></header>
            <table className="tbl">
              <tbody>
                <tr><td className="dim">Late work</td><td className="b">{c.late ? <span className="tag bad">{c.late}</span> : <span className="tag ok">none</span>}</td></tr>
                <tr><td className="dim">Open decisions</td><td className="b">{c.escalations ? <span className="tag bad">{c.escalations}</span> : <span className="tag ok">none</span>}</td></tr>
                <tr><td className="dim">Undecided asks</td><td className="b">{c.requests ? <span className="tag warn">{c.requests}</span> : <span className="tag ok">none</span>}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
