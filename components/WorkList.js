'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LABEL, TAG, KINDS, verbsFor, scopeFilter, tabsFor, isLate, canAssign, assignableTo } from '../lib/work';

const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

function NewWork({ projects, people, who, onDone, onCancel }) {
  const allowed = assignableTo(who);
  const canGiveTo = allowed === null ? people : people.filter((p) => allowed.includes(p.slug));
  const [f, setF] = useState({ projectSlug: projects[0]?.slug || '', title: '', kind: 'page', assignee: '', due: '', brief: '', acceptance: '', firstTime: false });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', ...f }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) onDone(); else setErr(j.error);
  }

  return (
    <div className="panel">
      <header><h2>Open new work</h2><button className="btn sm" onClick={onCancel}>Cancel</button></header>
      <div style={{ padding: '14px 16px', display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <label><div className="k">Project</div>
          <select className="inp" value={f.projectSlug} onChange={(e) => set('projectSlug', e.target.value)}>
            {projects.map((p) => <option key={p.slug} value={p.slug}>{p.client}, {p.name}</option>)}
          </select></label>
        <label><div className="k">What is it</div>
          <select className="inp" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.keys(KINDS).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select></label>
        <label><div className="k">Who is doing it</div>
          <select className="inp" value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
            <option value="">Nobody yet</option>
            {canGiveTo.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select></label>
        <label><div className="k">Due</div><input className="inp" type="date" value={f.due} onChange={(e) => set('due', e.target.value)} /></label>
        <label style={{ gridColumn: '1 / -1' }}><div className="k">Title</div>
          <input className="inp" value={f.title} placeholder="Destination page, Amalfi Coast" onChange={(e) => set('title', e.target.value)} /></label>
        <label style={{ gridColumn: '1 / -1' }}><div className="k">Brief</div>
          <textarea className="inp" value={f.brief} onChange={(e) => set('brief', e.target.value)} /></label>
        <label style={{ gridColumn: '1 / -1' }}><div className="k">What counts as done</div>
          <input className="inp" value={f.acceptance} placeholder="Live on staging, copy signed off, images compressed" onChange={(e) => set('acceptance', e.target.value)} /></label>
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={f.firstTime} onChange={(e) => set('firstTime', e.target.checked)} />
          First time we have done this, somebody shadows it
        </label>
      </div>
      {err ? <div style={{ padding: '0 16px 12px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
        <button className="btn dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Open it'}</button>
      </div>
    </div>
  );
}

export default function WorkList({ who, people, projects, canCreate }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState('mine');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState({});

  function load() {
    fetch('/api/work').then((r) => r.json()).then((j) => (j.ok ? setItems(j.items) : setErr(j.error))).catch((e) => setErr(String(e)));
  }
  useEffect(load, []);

  async function assign(id, slug) {
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'assign', id, assignee: slug }),
    });
    const j = await r.json();
    if (j.ok) { setItems((prev) => prev.map((i) => (i._id === id ? j.item : i))); setNote({ ...note, [id]: '' }); }
    else setNote({ ...note, [id]: j.error });
  }

  async function move(id, verb, extra) {
    const r = await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', id, verb, ...(extra || {}) }) });
    const j = await r.json();
    if (j.ok) setItems((prev) => prev.map((i) => (i._id === id ? j.item : i)));
    else setNote({ ...note, [id]: j.error });
  }

  const tabs = tabsFor(who);
  const shown = items ? scopeFilter(items, who, tab) : [];

  return (
    <>
      {canCreate ? (
        adding
          ? <NewWork projects={projects} people={people} who={who} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
          : <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setAdding(true)}>Open new work</button></div>
      ) : null}

      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}{items ? ' (' + scopeFilter(items, who, k).length + ')' : ''}
          </button>))}
      </div>

      <div className="panel" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not load work</b><span className="err">{err}</span></div></div> : null}
        {!items && !err ? <div className="empty">Loading.</div> : null}
        {items ? (
          <table className="tbl">
            <thead><tr><th>What</th><th style={{ width: 150 }}>Project</th><th style={{ width: 108 }}>Who</th><th style={{ width: 84 }}>Due</th><th style={{ width: 118 }}>State</th><th style={{ width: 230 }}>Next step</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const vs = verbsFor(i, who).filter((v) => v.ok && !v.needNote && !v.needWho);
                return (
                  <tr key={i._id}>
                    <td><Link href={'/work/' + i._id}>{i.title}</Link>
                      <div style={{ color: 'var(--faint)', fontSize: 12 }}>{KINDS[i.kind]?.label || i.kind}
                        {i.firstTime ? <span className="tag info" style={{ marginLeft: 5 }}>first time</span> : null}</div></td>
                    <td>{i.projectName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{i.client}</div></td>
                    <td>{(() => {
                      const ch = canAssign(i, who);
                      if (!ch.ok) return i.assigneeName || <span className="tag warn">nobody</span>;
                      const list = ch.list === null ? people : people.filter((p) => ch.list.includes(p.slug));
                      return (
                        <select className="inp" style={{ padding: '4px 6px', fontSize: 12.5 }}
                          value={i.assignee || ''} onChange={(e) => assign(i._id, e.target.value)}>
                          <option value="">Nobody</option>
                          {list.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                        </select>);
                    })()}</td>
                    <td className="mono">{dayOf(i.due) || '—'}
                      {isLate(i) ? <div><span className="tag bad">late</span></div> : null}</td>
                    <td><span className={'tag ' + (TAG[i.state] || 'mute')}>{LABEL[i.state]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {vs.map((v) => (
                          <button key={v.name} className="btn sm" onClick={() => move(i._id, v.name, { link: i.driveLink })}>{v.label}</button>))}
                        {vs.length === 0 ? <Link className="btn sm" href={'/work/' + i._id}>Open it</Link> : null}
                      </div>
                      {note[i._id] ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 5 }}>{note[i._id]}</div> : null}
                    </td>
                  </tr>);
              })}
              {shown.length === 0 ? <tr><td colSpan={6} className="empty">
                {tab === 'mine' ? 'Nothing assigned to you.' : tab === 'tome' ? 'Nothing waiting on your sign off.' : 'Nothing here.'}
              </td></tr> : null}
            </tbody>
          </table>
        ) : null}
      </div>
      <p className="note">
        Only actions you are allowed to take appear. Anything needing a note or a client name opens
        on the item's own page, because a one word button is not a record.
      </p>
    </>
  );
}
