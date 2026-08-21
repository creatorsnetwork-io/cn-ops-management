'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LABEL, TAG, KINDS, verbsFor, scopeFilter, tabsFor, isLate, canAssign, assignableTo } from '../lib/work';
import { can } from '../lib/perm';

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
    if (j.ok) {
      setItems((prev) => prev.map((i) => (i._id === id ? j.item : i)));
      setNote((prev) => ({ ...prev, [id]: '' }));
    }
    else setNote({ ...note, [id]: j.error });
  }

  const tabs = tabsFor(who);
  const shown = items ? scopeFilter(items, who, tab) : [];
  const mine = items ? scopeFilter(items, who, 'mine') : [];
  const coming = items ? scopeFilter(items, who, 'tome') : [];
  const visible = items ? (tabs.some(([k]) => k === 'all')
    ? scopeFilter(items, who, 'all')
    : Array.from(new Map(mine.concat(coming).map((i) => [i._id, i])).values())) : [];
  const atGate = visible.filter((i) => ['submitted', 'craft', 'ship', 'client'].includes(i.state));
  const grouped = shown.reduce((all, item) => {
    const key = item.projectSlug || 'unlinked';
    if (!all[key]) all[key] = [];
    all[key].push(item);
    return all;
  }, {});

  function WorkRow({ item, showProject }) {
    const allowed = verbsFor(item, who).filter((v) => v.ok);
    const direct = allowed.filter((v) => !v.needNote && !v.needWho && (!v.needLink || item.driveLink));
    const detail = allowed.filter((v) => !direct.some((d) => d.name === v.name));
    const ch = canAssign(item, who);
    const list = ch.list === null ? people : people.filter((p) => (ch.list || []).includes(p.slug));
    const shortKind = ({ page: 'WEB', article: 'COPY', report: 'RPT', asset: 'ART', film: 'FILM', aivideo: 'AI', campaign: 'CMP', other: 'WORK' })[item.kind] || 'WORK';

    return (
      <div className="wi">
        <div className="ty">{shortKind}</div>
        <div className="tx">
          <b><Link href={'/work/' + item._id}>{item.title}</Link></b>
          <span>
            {showProject ? item.client + ' · ' + item.projectName + ' · ' : ''}
            {KINDS[item.kind]?.label || item.kind}
            {item.deliverable ? ' · counts toward ' + item.deliverable : ''}
            {item.firstTime ? ' · first time' : ''}
          </span>
        </div>
        <div className="mt work-owner">
          <div className="lbl">Owner</div>
          <div className="v">
            {ch.ok ? (
              <select className="inp" value={item.assignee || ''} onChange={(e) => assign(item._id, e.target.value)}>
                <option value="">Nobody</option>
                {list.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
            ) : item.assigneeName || <span className="tag warn">nobody</span>}
          </div>
        </div>
        <div className="mt">
          <div className="lbl">Due</div>
          <div className="v mono">{dayOf(item.due) || 'Not set'}</div>
          {isLate(item) ? <span className="tag bad">late</span> : null}
        </div>
        <div className="mt">
          <div className="lbl">State</div>
          <div className="v"><span className={'tag ' + (TAG[item.state] || 'mute')}>{LABEL[item.state]}</span></div>
        </div>
        <div className="ac">
          {direct.map((v) => (
            <button key={v.name} className={'btn sm ' + (v.name === 'start' ? '' : 'dark')}
              onClick={() => move(item._id, v.name, { link: item.driveLink })}>{v.label}</button>
          ))}
          {detail.map((v) => <Link key={v.name} className="btn sm" href={'/work/' + item._id}>{v.label}</Link>)}
          <Link className="btn sm" href={'/projects/' + item.projectSlug}>Project</Link>
          {allowed.length === 0 ? <Link className="btn sm" href={'/work/' + item._id}>Open it</Link> : null}
        </div>
        {note[item._id] ? <div className="work-row-error">{note[item._id]}</div> : null}
      </div>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Production and handoffs</div>
          <h1>Work</h1>
          <p className="lede">Your work, the handoffs coming to you and the exact verbs that move each item forward.</p>
        </div>
        {canCreate ? <button className="btn dark" onClick={() => setAdding(true)}>Add work item</button> : null}
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lbl">Assigned to you</div><div className="v">{items ? mine.length : '...'}</div><div className="n">your active list</div></div>
        <div className="kpi"><span className="d a" /><div className="lbl">Coming to you</div><div className="v">{items ? coming.length : '...'}</div><div className="n">someone else owns it now</div></div>
        <div className="kpi"><span className="d r" /><div className="lbl">Sitting at a gate</div><div className="v">{items ? atGate.length : '...'}</div><div className="n bad">within your visible scope</div></div>
        <div className="kpi"><div className="lbl">Your rights</div><div className="v sm">{can(who, 'generate') === 'yes' ? 'Full generation' : can(who, 'generate')}</div><div className="n">from the permissions table</div></div>
      </div>

      {adding ? <NewWork projects={projects} people={people} who={who} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} /> : null}

      <div className="tabsrow">
        {tabs.map(([k, l]) => (
          <button key={k} className={'tb ' + (tab === k ? 'on' : '')} onClick={() => setTab(k)}>
            {l}{items ? ' (' + scopeFilter(items, who, k).length + ')' : ''}
          </button>))}
      </div>

      {err ? <div className="panel"><div className="row"><span className="dot no" /><div className="t"><b>Could not load work</b><span className="err">{err}</span></div></div></div> : null}
      {!items && !err ? <div className="panel"><div className="empty">Loading.</div></div> : null}
      {items && ['team', 'all'].includes(tab) ? (
        Object.keys(grouped).length ? Object.keys(grouped).map((key) => {
          const first = grouped[key][0];
          return (
            <div className="panel work-project" key={key}>
              <header><div><h2>{first.client} · {first.projectName}</h2><div className="sub2">{grouped[key].length} active item{grouped[key].length === 1 ? '' : 's'}</div></div>
                <Link className="btn sm" href={'/projects/' + first.projectSlug}>Open project</Link></header>
              {grouped[key].map((i) => <WorkRow key={i._id} item={i} showProject={false} />)}
            </div>
          );
        }) : <div className="panel"><div className="empty">Nothing in this view.</div></div>
      ) : null}
      {items && !['team', 'all'].includes(tab) ? (
        <div className="panel work-project">
          <header><div><h2>{tab === 'mine' ? 'Assigned to you' : 'Waiting on someone else, then you'}</h2>
            <div className="sub2">Each row shows every action your role can take right now.</div></div></header>
          {shown.length ? shown.map((i) => <WorkRow key={i._id} item={i} showProject />)
            : <div className="empty">{tab === 'mine' ? 'Nothing assigned to you.' : 'Nothing waiting on your sign off.'}</div>}
        </div>
      ) : null}
      <p className="note">
        Only actions you are allowed to take appear. Anything needing a note or a client name opens
        on the item's own page, because a one word button is not a record.
      </p>
    </>
  );
}
