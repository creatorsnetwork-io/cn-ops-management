'use client';
import { useState } from 'react';
import Link from 'next/link';
import PermButton from './PermButton';

const TYPE = {
  social: 'Social retainer', website: 'Website', seo: 'SEO',
  influencer: 'Influencer', video: 'Film or shoot', aiVideo: 'AI video', events: 'Event',
};
const SHORT = { social: 'SOC', website: 'WEB', seo: 'SEO', influencer: 'INF', video: 'FLM', aiVideo: 'AIV', events: 'EVT' };
const tagFor = (h) => ({
  'On track': 'ok', Watch: 'warn', 'Needs attention': 'bad', 'Winding down': 'warn',
  Written: 'ok', Draft: 'warn', Missing: 'bad', Complete: 'ok', Onboarding: 'warn', Closed: 'mute',
}[h] || 'mute');
const pct = (a, b) => (!b ? 0 : Math.min(100, Math.round((a / b) * 100)));

function Star({ kind, slug, on, onDone }) {
  const [lit, setLit] = useState(on);
  return (
    <button className={'star' + (lit ? ' on' : '')} title={lit ? 'Starred by you' : 'Star it, only you see this'}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = await fetch('/api/fav', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, slug }) }).then((x) => x.json());
        if (r.ok) { setLit(r.on); if (onDone) onDone(slug, r.on); }
      }}>{lit ? '★' : '☆'}</button>);
}

function Controls({ favOnly, setFavOnly, grid, setGrid, types, filter, setFilter, counts }) {
  return (
    <div className="filters">
      {types ? types.map((t) => (
        <button key={t} className={'fchip' + (filter === t ? ' on' : '')} onClick={() => setFilter(t)}>
          {t === 'all' ? 'All' : TYPE[t] || t}
        </button>)) : (
        <>
          <button className={'fchip' + (favOnly ? '' : ' on')} onClick={() => setFavOnly(false)}>All{counts ? ' ' + counts.all : ''}</button>
          <button className={'fchip' + (favOnly ? ' on' : '')} onClick={() => setFavOnly(true)}>★ Favourites{counts ? ' ' + counts.fav : ''}</button>
        </>)}
      {types ? <button className={'fchip' + (favOnly ? ' on' : '')} onClick={() => setFavOnly(!favOnly)}>★</button> : null}
      <div className="vtoggle">
        <button className={grid ? 'on' : ''} onClick={() => setGrid(true)}>Cards</button>
        <button className={grid ? '' : 'on'} onClick={() => setGrid(false)}>List</button>
      </div>
    </div>);
}

/* ============================ CLIENTS ============================ */
export function ClientsBrowse({ who, rows, favs, canAdd }) {
  const [favOnly, setFavOnly] = useState(false);
  const [grid, setGrid] = useState(true);
  const [fav, setFav] = useState(favs || []);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', code: '', driveFolderId: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const starred = (s) => fav.includes(s);
  const onStar = (s, on) => setFav(on ? [...fav, s] : fav.filter((x) => x !== s));

  let list = rows.slice().sort((a, b) => (starred(b.slug) ? 1 : 0) - (starred(a.slug) ? 1 : 0));
  if (favOnly) list = list.filter((c) => starred(c.slug));

  async function add() {
    setBusy(true); setErr('');
    const r = await fetch('/api/client-admin', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...f }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.ok) window.location.href = '/clients/' + r.slug; else setErr(r.error);
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow n">Accounts and relationships</div>
          <h1>Clients</h1>
          <p className="lede">
            A client owns the standing brand brain. Every contract, timeline and deliverable
            lives in a project beneath it.
          </p>
        </div>
        {canAdd ? <PermButton who={who} cap="createClient" label="Add client" dark onClick={() => setAdding(!adding)} /> : null}
      </div>

      {adding ? (
        <div className="panel">
          <header><h2>Add a client</h2><button className="btn sm" onClick={() => setAdding(false)}>Cancel</button></header>
          <div className="pad" style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <label><div className="fl">Name</div><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label><div className="fl">Short code</div><input type="text" value={f.code} placeholder="left blank, made from the name" onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
            <label><div className="fl">Drive folder link or ID</div><input type="text" value={f.driveFolderId} onChange={(e) => setF({ ...f, driveFolderId: e.target.value })} /></label>
            <label style={{ gridColumn: '1 / -1' }}><div className="fl">Anything the team should know</div><input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          </div>
          {err ? <div className="pad" style={{ paddingTop: 0, color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
          <div style={{ padding: '12px 15px', borderTop: '1px solid var(--line2)' }}>
            <button className="btn dark" disabled={busy} onClick={add}>{busy ? 'Adding' : 'Add it'}</button>
          </div>
        </div>) : null}

      <Controls favOnly={favOnly} setFavOnly={setFavOnly} grid={grid} setGrid={setGrid}
        counts={{ all: rows.length, fav: rows.filter((c) => starred(c.slug)).length }} />

      {grid ? (
        <div className="cards">
          {list.map((c) => (
            <div className="card" key={c.slug}>
              <div className="ctop">
                {c.logoUrl
                  ? <img src={c.logoUrl} alt="" style={{ height: 38, maxWidth: 110, objectFit: 'contain' }} />
                  : <div className="cmark" style={{ width: 38, height: 38, fontSize: 11.5 }} title={c.name}>{(c.code || c.slug).slice(0, 4)}</div>}
                <div className="rowb" style={{ alignItems: 'center' }}>
                  <Star kind="client" slug={c.slug} on={starred(c.slug)} onDone={onStar} />
                  <span className={'tag ' + tagFor(c.health)}>{c.health}</span>
                </div>
              </div>
              <h3>{c.name}</h3>
              <div className="cs">{c.typeLabel}</div>
              <div className="metagrid">
                <div><div className="lbl">Lead</div><div className="v">{c.lead || 'Not set'}</div></div>
                <div><div className="lbl">Brand brain</div><div className="v"><span className={'tag ' + tagFor(c.brain)}>{c.brain}</span></div></div>
                <div><div className="lbl">Projects</div><div className="v">{c.projects.length}</div></div>
                <div><div className="lbl">Setup</div><div className="v">
                  {c.setup >= 9 ? <span className="tag ok">Complete</span> : <span className="tag warn">{c.setup} of 9</span>}
                </div></div>
                <div style={{ gridColumn: '1 / -1' }}><div className="lbl">Renewal</div><div className="v">{c.renewal || 'Not set'}</div></div>
              </div>
              <div className="cfoot">
                <div className="rowb">
                  <Link className="btn sm" href={'/clients/' + c.slug}>Open</Link>
                  {c.setup < 9 ? <Link className="btn sm" href={'/clients/' + c.slug + '#setup'}>Finish setup</Link> : null}
                </div>
                <div className="chipsline">{c.projects.slice(0, 4).map((p) => <span className="tchip" key={p.slug}>{SHORT[p.type] || p.type.slice(0, 3).toUpperCase()}</span>)}</div>
              </div>
            </div>))}
          {list.length === 0 ? <div className="panel"><div className="pad note">{favOnly ? 'Nothing starred yet.' : 'No clients.'}</div></div> : null}
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead><tr><th style={{ width: 34 }} /><th>Client</th><th>Type</th><th>Lead</th><th>Projects</th><th>Brand brain</th><th>Setup</th><th>Health</th><th>Renewal</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.slug}>
                  <td><Star kind="client" slug={c.slug} on={starred(c.slug)} onDone={onStar} /></td>
                  <td className="b"><Link href={'/clients/' + c.slug}>{c.name}</Link><div className="dim" style={{ fontSize: 12 }}>{c.code}</div></td>
                  <td className="dim">{c.typeLabel}</td>
                  <td className="dim">{c.lead || 'Not set'}</td>
                  <td className="num">{c.projects.length}</td>
                  <td><span className={'tag ' + tagFor(c.brain)}>{c.brain}</span></td>
                  <td className="dim">{c.setup} of 9</td>
                  <td><span className={'tag ' + tagFor(c.health)}>{c.health}</span></td>
                  <td className="dim">{c.renewal || 'Not set'}</td>
                </tr>))}
              {list.length === 0 ? <tr><td colSpan={9} className="dim">{favOnly ? 'Nothing starred yet.' : 'No clients.'}</td></tr> : null}
            </tbody>
          </table>
        </div>)}
    </>);
}

/* ============================ PROJECTS ============================ */
export function ProjectsBrowse({ who, rows, clients, people, favs, openAdd, initialClient }) {
  const [favOnly, setFavOnly] = useState(false);
  const [grid, setGrid] = useState(true);
  const [filter, setFilter] = useState('all');
  const [fav, setFav] = useState(favs || []);
  const [adding, setAdding] = useState(!!openAdd);
  const [f, setF] = useState({ name: '', clientSlug: initialClient || (clients[0] || {}).slug || '', type: 'social', owner: who, why: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const starred = (s) => fav.includes(s);
  const onStar = (s, on) => setFav(on ? [...fav, s] : fav.filter((x) => x !== s));

  const types = ['all', 'social', 'website', 'seo', 'influencer', 'video', 'aiVideo', 'events'];
  let list = rows.filter((p) => filter === 'all' || p.type === filter);
  if (favOnly) list = list.filter((p) => starred(p.slug));
  list = list.sort((a, b) => (starred(b.slug) ? 1 : 0) - (starred(a.slug) ? 1 : 0));

  async function add() {
    setBusy(true); setErr(''); setMsg('');
    const r = await fetch('/api/project', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f),
    }).then((x) => x.json());
    setBusy(false);
    if (r.ok && r.slug) { window.location.href = '/projects/' + r.slug; return; }
    if (r.ok && r.requested) { setAdding(false); setMsg('Your lead has it. Nothing was created yet.'); return; }
    setErr(r.error);
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow n">Engagements</div>
          <h1>Projects</h1>
          <p className="lede">Each project carries its own service template, workflow, contract and deliverables.</p>
        </div>
        <PermButton who={who} cap="createProject" label="New project" dark
          onClick={() => setAdding(!adding)} onRequest={() => setAdding(!adding)} />
      </div>

      {msg ? <div className="guard">{msg}</div> : null}

      {adding ? (
        <div className="panel">
          <header>
            <h2>New project</h2>
            <button className="btn sm" onClick={() => setAdding(false)}>Cancel</button>
          </header>
          <div className="pad" style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <label><div className="fl">Client</div>
              <select className="f" value={f.clientSlug} onChange={(e) => setF({ ...f, clientSlug: e.target.value })}>
                {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select></label>
            <label><div className="fl">Service</div>
              <select className="f" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {types.filter((t) => t !== 'all').map((t) => <option key={t} value={t}>{TYPE[t]}</option>)}
              </select></label>
            <label><div className="fl">Owner</div>
              <select className="f" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
                {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select></label>
            <label style={{ gridColumn: '1 / -1' }}><div className="fl">Name</div>
              <input type="text" value={f.name} placeholder="EGC social retainer" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          </div>
          <div className="pad" style={{ paddingTop: 0, fontSize: 12.5, color: 'var(--faint)' }}>
            The cadence is set by the service: social is tracked weekly, SEO monthly, websites and
            campaigns by milestone, film one asset at a time.
          </div>
          {err ? <div className="pad" style={{ paddingTop: 0, color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
          <div style={{ padding: '12px 15px', borderTop: '1px solid var(--line2)' }}>
            <button className="btn dark" disabled={busy} onClick={add}>{busy ? 'Working' : 'Open it'}</button>
          </div>
        </div>) : null}

      <Controls types={types} filter={filter} setFilter={setFilter} favOnly={favOnly} setFavOnly={setFavOnly} grid={grid} setGrid={setGrid} />

      {grid ? (
        <div className="cards3">
          {list.map((p) => (
            <div className="card" key={p.slug}>
              <div className="ctop">
                <span className="tchip">{TYPE[p.type] || p.type}</span>
                <div className="rowb" style={{ alignItems: 'center' }}>
                  <Star kind="project" slug={p.slug} on={starred(p.slug)} onDone={onStar} />
                  <span className={'tag ' + tagFor(p.health)}>{p.health}</span>
                </div>
              </div>
              <div className="lbl" style={{ marginTop: 11 }}>{p.client}</div>
              <h3 style={{ marginTop: 3, fontSize: 16 }}>{p.name}</h3>
              <div className="cs">{p.subtitle} · {p.term}</div>
              <div style={{ marginTop: 11, fontSize: 12, color: 'var(--muted)' }}>
                {p.timeline}<br />Owner {p.owner || 'not assigned'}
              </div>
              <div style={{ marginTop: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
                  <span>Client approved</span><b style={{ color: 'var(--ink)' }}>{p.approved} / {p.target || '?'}</b>
                </div>
                <div className="bar2" style={{ marginTop: 5 }}><i style={{ width: pct(p.approved, p.target) + '%' }} /></div>
              </div>
              <div className="cfoot">
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.stage}</span>
                <Link className="btn sm" href={'/projects/' + p.slug}>Open</Link>
              </div>
            </div>))}
          {list.length === 0 ? <div className="panel"><div className="pad note">Nothing here.</div></div> : null}
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead><tr><th style={{ width: 34 }} /><th>Client</th><th>Project</th><th>Service</th><th>Owner</th><th>Stage</th><th>Approved</th><th>State</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.slug}>
                  <td><Star kind="project" slug={p.slug} on={starred(p.slug)} onDone={onStar} /></td>
                  <td className="b">{p.client}</td>
                  <td><Link href={'/projects/' + p.slug}>{p.name}</Link></td>
                  <td className="dim">{TYPE[p.type] || p.type}</td>
                  <td className="dim">{p.owner || 'Not set'}</td>
                  <td className="dim">{p.stage}</td>
                  <td className="dim">{p.approved} / {p.target || '?'}</td>
                  <td><span className={'tag ' + tagFor(p.health)}>{p.health}</span></td>
                </tr>))}
              {list.length === 0 ? <tr><td colSpan={8} className="dim">Nothing here.</td></tr> : null}
            </tbody>
          </table>
        </div>)}
    </>);
}
