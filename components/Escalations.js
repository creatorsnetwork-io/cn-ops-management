'use client';
import { useState } from 'react';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const sitting = (e) => {
  const hops = e.hops || [];
  const last = hops.length ? hops[hops.length - 1].at : e.at;
  if (!last) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(last).getTime()) / 3600000));
};

function Row({ e, people, who, canResolve, onDone }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState('fixed');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function resolve() {
    if (!text.trim()) { setErr('Say what happened, otherwise this record is worthless later.'); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/escalation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id: e._id, resolution: text, outcome }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) onDone(e._id, { resolution: text, outcome, resolvedBy: 'you', resolvedAt: new Date().toISOString() });
    else setErr(j.error);
  }

  async function passUp() {
    if (!text.trim()) { setErr('Say why you cannot decide it.'); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/escalation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'passUp', id: e._id, note: text }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) window.location.reload(); else setErr(j.error);
  }

  async function own(action, slug) {
    setBusy(true); setErr('');
    const r = await fetch('/api/escalation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id: e._id, slug }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) onDone(e._id, { owner: j.owner, ownerName: (people.find((p) => p.slug === j.owner) || {}).name || null });
    else setErr(j.error);
  }

  const hops = e.hops || [];
  const passed = Math.max(0, hops.length - 1);

  return (
    <>
      <tr>
        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{when(e.at)}
          {e.kind === 'manual' ? <div><span className="tag info">asked for</span></div> : null}
          {passed ? <div><span className="tag warn">passed up {passed}x</span></div> : null}</td>
        <td>{e.who}</td>
        <td><b>{e.reason}</b>{e.detail ? <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>{e.detail}</div> : null}</td>
        <td>{e.projectName || '—'}{e.week ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>week of {e.week}</div> : null}</td>
        <td>
          {e.resolvedAt ? (e.ownerName || <span className="tag mute">nobody</span>)
            : canResolve ? (
              <select className="inp" style={{ padding: '4px 6px', fontSize: 12.5 }} value={e.owner || ''} disabled={busy}
                onChange={(ev) => (ev.target.value ? own('give', ev.target.value) : own('unassign'))}>
                <option value="">Nobody yet</option>
                {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>)
            : e.owner === who ? <span className="tag info">you</span>
            : e.ownerName ? e.ownerName
            : <button className="btn sm" disabled={busy} onClick={() => own('take')}>I will take it</button>}
          {!e.resolvedAt && canResolve && e.owner !== who
            ? <div style={{ marginTop: 4 }}><button className="btn link" style={{ fontSize: 12 }} disabled={busy} onClick={() => own('take')}>I will take it</button></div>
            : null}
        </td>
        <td>
          {e.resolvedAt
            ? <><span className="tag ok">closed</span><div style={{ color: 'var(--faint)', fontSize: 12, marginTop: 3 }}>{e.resolvedBy}, {when(e.resolvedAt)}</div></>
            : <span className="tag bad">open</span>}
          {e.resolution ? <div style={{ fontSize: 12.5, marginTop: 4 }}>{e.resolution}</div> : null}
          {!e.resolvedAt ? <div style={{ color: sitting(e) > 48 ? 'var(--bad)' : 'var(--faint)', fontSize: 12, marginTop: 3 }}>
            sitting {sitting(e)}h</div> : null}
        </td>
        <td>
          {e.projectSlug && e.week ? <a className="btn sm" href={'/projects/' + e.projectSlug + '/review?week=' + e.week}>The week</a> : null}
          {!e.resolvedAt && (canResolve || e.owner === who) ? <button className="btn sm" style={{ marginLeft: 5 }} onClick={() => { setOpen(open === 'close' ? false : 'close'); }}>Close it</button> : null}
          {!e.resolvedAt && e.owner === who ? <button className="btn sm" style={{ marginLeft: 5 }} onClick={() => setOpen(open === 'up' ? false : 'up')}>Cannot decide</button> : null}
        </td>
      </tr>
      {open && !e.resolvedAt ? (
        <tr><td colSpan={7} style={{ background: '#FCFDFE' }}>
          {open === 'close' ? (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <select className="inp" style={{ width: 'auto' }} value={outcome} onChange={(ev) => setOutcome(ev.target.value)}>
                <option value="fixed">Fixed it</option>
                <option value="accepted">Accepted as is</option>
                <option value="wont-fix">Leaving it</option>
              </select>
              <input className="inp" style={{ flex: 1, minWidth: 260 }} placeholder="What happened, in one line" value={text} onChange={(ev) => setText(ev.target.value)} />
              <button className="btn sm dark" disabled={busy} onClick={resolve}>{busy ? 'Saving' : 'Close'}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <input className="inp" style={{ flex: 1, minWidth: 300 }} placeholder="Why you cannot decide this" value={text} onChange={(ev) => setText(ev.target.value)} />
              <button className="btn sm dark" disabled={busy} onClick={passUp}>{busy ? 'Sending' : 'Pass it up'}</button>
            </div>
          )}
          {hops.length ? (
            <div style={{ marginTop: 12, fontSize: 12.5 }}>
              <div className="k" style={{ marginBottom: 5 }}>How it got here</div>
              {hops.map((h, n) => (
                <div key={h._key || n} style={{ color: 'var(--muted)' }}>
                  {h.from || 'raised'} to <b>{h.to}</b> · {when(h.at)}{h.note ? ' · ' + h.note : ''}
                </div>))}
            </div>) : null}
          {err ? <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 7 }}>{err}</div> : null}
        </td></tr>
      ) : null}
    </>
  );
}

export default function Escalations({ items, people, who, canResolve }) {
  const [rows, setRows] = useState(items);
  const [tab, setTab] = useState('open');

  function onDone(id, patch) { setRows(rows.map((r) => (r._id === id ? { ...r, ...patch } : r))); }

  const open = rows.filter((r) => !r.resolvedAt);
  const mine = rows.filter((r) => !r.resolvedAt && r.owner === who);
  const closed = rows.filter((r) => r.resolvedAt);
  const shown = tab === 'open' ? open : tab === 'mine' ? mine : closed;

  return (
    <>
      <div className="tabs">
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open ({open.length})</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Mine ({mine.length})</button>
        <button className={tab === 'closed' ? 'on' : ''} onClick={() => setTab('closed')}>Closed ({closed.length})</button>
      </div>
      <div className="panel" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <table className="tbl">
          <thead><tr><th style={{ width: 128 }}>When</th><th style={{ width: 92 }}>Who</th><th>Why</th><th style={{ width: 150 }}>Where</th><th style={{ width: 130 }}>Who owns it</th><th style={{ width: 175 }}>State</th><th style={{ width: 150 }} /></tr></thead>
          <tbody>
            {shown.map((e) => <Row key={e._id} e={e} people={people} who={who} canResolve={canResolve} onDone={onDone} />)}
            {shown.length === 0 ? <tr><td colSpan={7} className="empty">
              {tab === 'open' ? 'Nothing open. Nobody has needed you this week.'
                : tab === 'mine' ? 'Nothing sitting with you.' : 'Nothing closed yet.'}
            </td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
