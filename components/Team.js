'use client';
import { useState } from 'react';
import Link from 'next/link';

function Email({ slug, initial, canEdit, domain }) {
  const [v, setV] = useState(initial || '');
  const [state, setState] = useState('');

  async function save() {
    if ((initial || '') === v) return;
    setState('saving');
    const r = await fetch('/api/person', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'edit', slug, email: v.trim() }),
    });
    const j = await r.json();
    setState(j.ok ? 'saved' : 'bad');
    if (!j.ok) setState('bad');
    setTimeout(() => setState(''), 1600);
  }

  if (!canEdit) return <span className="dim">{v || 'Not recorded'}</span>;
  const wrong = v.trim() && !v.trim().toLowerCase().endsWith('@' + domain);

  return (
    <>
      <input className="inp" style={{ fontSize: 12.5, borderColor: wrong ? 'var(--bad)' : undefined }}
        value={v} placeholder={'name@' + domain} onChange={(e) => setV(e.target.value)} onBlur={save} />
      {wrong ? <div style={{ fontSize: 11.5, color: 'var(--bad)', marginTop: 3 }}>Sign in only accepts {domain}</div> : null}
      {state === 'saving' ? <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>saving</div> : null}
      {state === 'saved' ? <div style={{ fontSize: 11.5, color: 'var(--ok)', marginTop: 3 }}>saved</div> : null}
      {state === 'bad' ? <div style={{ fontSize: 11.5, color: 'var(--bad)', marginTop: 3 }}>did not save</div> : null}
    </>);
}

function Capacity({ rows, weekLabel }) {
  const active = rows.filter((r) => r.active);
  const over = active.filter((r) => r.thisWeek > r.comfortable);
  const missingBackups = active.length;

  return (
    <>
      <div className="panel">
        <header><h2>Load</h2><span className="hint">jobs due this week and next</span></header>
        <table className="tbl">
          <thead><tr><th>Person</th><th>Role</th><th className="num">Comfortable</th><th className="num">This week</th><th className="num">Next week</th><th>Load</th><th>Note</th></tr></thead>
          <tbody>
            {active.map((p) => {
              const overLimit = p.thisWeek > p.comfortable;
              const width = Math.min(100, Math.round((p.thisWeek / Math.max(1, p.comfortable)) * 100));
              return (
                <tr key={p.slug} className={overLimit ? 'flag' : ''}>
                  <td className="b">{p.name}</td>
                  <td className="dim">{p.role || 'No role written'}</td>
                  <td className="num">{p.comfortable}</td>
                  <td className="num b">{p.thisWeek}</td>
                  <td className="num">{p.nextWeek}</td>
                  <td><div className="bar2"><i className={overLimit ? 'r' : ''} style={{ width: width + '%' }} /></div></td>
                  <td className="dim">{overLimit ? 'Over capacity for ' + weekLabel : p.open + ' open overall'}</td>
                </tr>);
            })}
            {active.length === 0 ? <tr><td colSpan={7} className="empty">No active team members.</td></tr> : null}
          </tbody>
        </table>
        <div className="panelNote">Items without a due date remain in each person's open total, but cannot be assigned to this week or next week.</div>
      </div>

      <div className="grid2">
        <div className="panel">
          <header><h2>Coverage</h2><span className="hint">who backs whom</span></header>
          <table className="tbl"><tbody>
            {active.map((p) => <tr key={p.slug}><td className="b" style={{ width: 150 }}>{p.name}</td><td className="dim">Backup not recorded</td></tr>)}
          </tbody></table>
          <div className="panelNote">The person API has no backup or succession field. {missingBackups} active role{missingBackups === 1 ? '' : 's'} therefore remain explicitly unrecorded.</div>
        </div>
        <div className="panel">
          <header><h2>Overflow to the founder</h2></header>
          <table className="tbl"><tbody>
            <tr><td className="b" style={{ width: 145 }}>This week</td><td className="dim">{over.length ? over.map((p) => p.name + ' at ' + p.thisWeek + ' of ' + p.comfortable).join(', ') : 'No one is over the operating threshold'}</td></tr>
            <tr><td className="b">Cause</td><td className="dim">{over.length ? over.flatMap((p) => p.thisWeekTitles).slice(0, 4).join(', ') || 'Due work' : 'No overflow detected'}</td></tr>
            <tr><td className="b">Structural action</td><td className="dim">Not recorded</td></tr>
            <tr><td className="b">Alternative</td><td className="dim">Use the administration register below to check reporting lines and project ownership</td></tr>
          </tbody></table>
        </div>
      </div>
    </>
  );
}

export default function Team({ rows, canEdit, domain, weekLabel }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', role: '', email: '', reportsTo: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(body) {
    setBusy(true); setErr('');
    const r = await fetch('/api/person', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (j.ok) window.location.reload(); else setErr(j.error);
  }

  return (
    <>
      <Capacity rows={rows} weekLabel={weekLabel} />

      <div className="sectionLabel">Team administration</div>
      {canEdit ? (adding ? (
        <div className="panel">
          <header><h2>Add someone</h2><button className="btn sm" onClick={() => setAdding(false)}>Cancel</button></header>
          <div style={{ padding: '14px 16px', display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <label><div className="k">Name</div><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label><div className="k">What they do</div><input className="inp" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></label>
            <label><div className="k">Work email</div><input className="inp" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label><div className="k">Reports to</div>
              <select className="inp" value={f.reportsTo} onChange={(e) => setF({ ...f, reportsTo: e.target.value })}>
                <option value="">Nobody</option>
                {rows.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select></label>
          </div>
          {err ? <div style={{ padding: '0 16px 12px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
            <button className="btn dark" disabled={busy} onClick={() => send({ action: 'add', ...f })}>Add them</button>
          </div>
        </div>
      ) : <div style={{ marginTop: 18 }}><button className="btn dark" onClick={() => setAdding(true)}>Add someone</button></div>) : null}

      <div className="panel">
        <header><h2>People, access and reporting lines</h2><span className="pill">{rows.filter((r) => r.active).length} active</span></header>
        <table className="tbl">
          <thead><tr>
            <th>Person</th><th style={{ width: 210 }}>Work email</th><th style={{ width: 118 }}>Reports to</th>
            <th style={{ width: 92 }}>Open work</th><th style={{ width: 78 }}>Late</th>
            <th style={{ width: 108 }}>Waiting on them</th><th style={{ width: 150 }}>Owns</th>
            {canEdit ? <th style={{ width: 108 }} /> : null}
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug} style={{ opacity: p.active ? 1 : 0.5 }}>
                <td><b>{p.name}</b>{!p.active ? <span className="tag mute" style={{ marginLeft: 6 }}>inactive</span> : null}
                  <div style={{ color: 'var(--faint)', fontSize: 12 }}>{p.role || 'no role written'}</div>
                  </td>
                <td><Email slug={p.slug} initial={p.email} canEdit={canEdit} domain={domain || 'creatorsnetwork.io'} /></td>
                <td>{p.reportsToName || 'Not recorded'}</td>
                <td>{p.open ? <b>{p.open}</b> : 'None'}</td>
                <td>{p.late ? <span className="tag bad">{p.late}</span> : 'None'}</td>
                <td>{p.queue ? <span className="tag warn">{p.queue}</span> : 'None'}</td>
                <td>{(p.projects || []).length
                  ? (p.projects || []).map((x) => <div key={x.slug} style={{ fontSize: 12.5 }}><Link href={'/projects/' + x.slug}>{x.name}</Link></div>)
                  : <span style={{ color: 'var(--faint)' }}>nothing</span>}</td>
                {canEdit ? <td>
                  <button className="btn sm" disabled={busy}
                    onClick={() => send({ action: 'edit', slug: p.slug, active: !p.active })}>
                    {p.active ? 'Deactivate' : 'Bring back'}
                  </button></td> : null}
              </tr>))}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          The email is what Google sign in matches on. Somebody with no email here cannot get in,
          and it has to be the {(domain || 'creatorsnetwork.io')} address they actually use.
          Open work counts items not yet client approved. Waiting on them counts items sitting at a gate
          this person holds. Deactivating keeps their history and stops new work reaching them.
        </div>
      </div>
    </>
  );
}
