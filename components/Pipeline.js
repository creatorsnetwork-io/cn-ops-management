'use client';
import { Fragment, useEffect, useState } from 'react';

const STAGES = [['lead', 'Lead'], ['talking', 'In conversation'], ['proposal', 'Proposal out'], ['won', 'Won'], ['lost', 'Lost']];
const TAGOF = { lead: 'mute', talking: 'info', proposal: 'warn', won: 'ok', lost: 'bad' };
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const money = (n) => (n ? 'AED ' + Number(n).toLocaleString('en-GB') : 'Not set');
const today = () => new Date().toISOString().slice(0, 10);

export default function Pipeline({ people }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', market: 'Dubai', service: '', valueAed: '', nextStep: '', nextStepDate: '', source: '' });
  const [ask, setAsk] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('live');

  function load() {
    fetch('/api/prospect').then((r) => r.json()).then((j) => (j.ok ? setD(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  }
  useEffect(load, []);

  async function post(body) {
    setBusy(true); setErr('');
    const r = await fetch('/api/prospect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setAdding(false); setAsk(null); setNote(''); load(); } else setErr(j.error);
  }

  const items = (d && d.items) || [];
  const live = items.filter((p) => !['won', 'lost'].includes(p.stage));
  const closed = items.filter((p) => ['won', 'lost'].includes(p.stage));
  const shown = tab === 'live' ? live : closed;
  const weighted = live.reduce((a, p) => a + (p.valueAed || 0), 0);
  const overdue = live.filter((p) => p.nextStepDate && p.nextStepDate < today()).length;

  return (
    <>
      <div className="panel">
        <header><h2>Where it stands</h2>
          {d && d.canEdit ? <button className="btn sm dark" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add a prospect'}</button> : null}</header>
        <div className="pad">
          <div className="stats">
            <div><div className="lbl">Live</div><div className="v">{live.length}</div></div>
            <div><div className="lbl">If all landed</div><div className="v">{money(weighted)}</div><div className="s">per month</div></div>
            <div><div className="lbl">Next step overdue</div><div className="v" style={{ color: overdue ? 'var(--bad)' : undefined }}>{overdue}</div></div>
            <div><div className="lbl">Won</div><div className="v" style={{ color: 'var(--ok)' }}>{closed.filter((p) => p.stage === 'won').length}</div></div>
          </div>
          <p className="note" style={{ marginTop: 9 }}>
            The target is 10 to 20 thousand AED a month in new retainers, which is what replaces Liberty.
          </p>
        </div>
      </div>

      {adding ? (
        <div className="panel">
          <header><h2>Add a prospect</h2></header>
          <div className="pad two-in">
            <label><div className="fl">Who</div><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label><div className="fl">Market</div>
              <select className="f" value={f.market} onChange={(e) => setF({ ...f, market: e.target.value })}>
                {['Dubai', 'GCC', 'India', 'Europe', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select></label>
            <label><div className="fl">What they might buy</div><input type="text" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} /></label>
            <label><div className="fl">Monthly value, AED</div><input type="text" value={f.valueAed} onChange={(e) => setF({ ...f, valueAed: e.target.value })} /></label>
            <label><div className="fl">Where they came from</div><input type="text" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
            <label><div className="fl">Next step</div><input type="text" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} /></label>
            <label><div className="fl">By when</div><input type="date" value={f.nextStepDate} onChange={(e) => setF({ ...f, nextStepDate: e.target.value })} /></label>
          </div>
          {err ? <div style={{ padding: '0 16px 12px', color: 'var(--bad)', fontSize: 12.5 }}>{err}</div> : null}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line2)' }}>
            <button className="btn dark" disabled={busy} onClick={() => post({ action: 'add', ...f })}>Add</button>
          </div>
        </div>) : null}

      <div className="tabsrow">
        <button className={'tb ' + (tab === 'live' ? 'on' : '')} onClick={() => setTab('live')}>Live ({live.length})</button>
        <button className={'tb ' + (tab === 'closed' ? 'on' : '')} onClick={() => setTab('closed')}>Won and lost ({closed.length})</button>
      </div>

      <div className="panel">
        {!d && !err ? <div className="pad note">Loading.</div> : null}
        {d ? (
          <table>
            <thead><tr>
              <th>Who</th><th style={{ width: 88 }}>Market</th><th style={{ width: 120 }}>Monthly</th>
              <th style={{ width: 130 }}>Stage</th><th>Next step</th><th style={{ width: 250 }} />
            </tr></thead>
            <tbody>
              {shown.map((p) => {
                const idx = STAGES.findIndex((s) => s[0] === p.stage);
                const nxt = STAGES[idx + 1];
                return (
                  <Fragment key={p._id}>
                    <tr>
                      <td><b>{p.name}</b><div style={{ color: 'var(--faint)', fontSize: 12 }}>{p.service || 'not defined yet'}
                        {p.source ? ' · via ' + p.source : ''}</div></td>
                      <td>{p.market}</td>
                      <td>{money(p.valueAed)}</td>
                      <td><span className={'tag ' + TAGOF[p.stage]}>{(STAGES.find((s) => s[0] === p.stage) || [])[1]}</span>
                        {p.outcome ? <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{p.outcome}</div> : null}</td>
                      <td>{p.nextStep || <span style={{ color: 'var(--faint)' }}>nothing planned</span>}
                        {p.nextStepDate ? <div className="dim" style={{ fontSize: 12, color: p.nextStepDate < today() ? 'var(--bad)' : 'var(--faint)' }}>
                          {dayOf(p.nextStepDate)}{p.nextStepDate < today() ? ', overdue' : ''}</div> : null}
                        <div style={{ color: 'var(--faint)', fontSize: 12 }}>{p.ownerName}</div></td>
                      <td>{d.canEdit ? (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {nxt && nxt[0] !== 'lost' && !['won', 'lost'].includes(p.stage)
                            ? <button className="btn sm" disabled={busy}
                                onClick={() => (nxt[0] === 'won' ? setAsk({ p, stage: 'won' }) : post({ action: 'stage', id: p._id, stage: nxt[0] }))}>
                                {nxt[1]}</button> : null}
                          {!['won', 'lost'].includes(p.stage)
                            ? <button className="btn sm" onClick={() => setAsk({ p, stage: 'lost' })}>Lost</button> : null}
                          {['won', 'lost'].includes(p.stage)
                            ? <button className="btn sm" disabled={busy} onClick={() => post({ action: 'stage', id: p._id, stage: 'talking' })}>Reopen</button> : null}
                        </div>) : null}</td>
                    </tr>
                    {ask && ask.p._id === p._id ? (
                      <tr><td colSpan={6} style={{ background: '#FCFDFE' }}>
                        <label style={{ display: 'block' }}>
                          <div className="fl">{ask.stage === 'won' ? 'What did they sign, and at what' : 'Why it was lost'}</div>
                          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
                        </label>
                        {err ? <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 7 }}>{err}</div> : null}
                        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                          <button className="btn dark" disabled={busy} onClick={() => post({ action: 'stage', id: p._id, stage: ask.stage, note })}>
                            {ask.stage === 'won' ? 'Mark won' : 'Mark lost'}</button>
                          <button className="btn" onClick={() => { setAsk(null); setErr(''); }}>Cancel</button>
                        </div>
                      </td></tr>) : null}
                  </Fragment>);
              })}
              {shown.length === 0 ? <tr><td colSpan={6} className="dim">
                {tab === 'live' ? 'Nothing in the pipeline yet.' : 'Nothing closed yet.'}</td></tr> : null}
            </tbody>
          </table>) : null}
        {err && !d ? <div className="alertbar"><span><b>Could not load the pipeline.</b> {err}</span></div> : null}
      </div>
      <p className="note">
        Marking something lost asks why. Won asks what they actually signed, so the number in a
        renewal conversation is the real one rather than the one you hoped for.
      </p>
    </>
  );
}
