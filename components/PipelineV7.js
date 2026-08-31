'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const STAGE = {
  lead: ['Intro made', 'mute'], meeting: ['First meeting', 'info'], talking: ['Discovery', 'info'],
  proposal: ['Proposal sent', 'warn'], quoted: ['Quoted', 'warn'],
  won: ['Won', 'ok'], lost: ['Lost', 'mute'],
};
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'Not set');
const money = (n) => 'AED ' + Number(n || 0).toLocaleString('en-GB');
const today = () => new Date().toISOString().slice(0, 10);
const staleCutoff = () => new Date(Date.now() - 7 * 86400000).toISOString();
const isCold = (p) => p.nextStepDate ? p.nextStepDate < today() : !p.at || p.at < staleCutoff();

export default function PipelineV7({ people }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', market: 'Dubai', service: '', valueAed: '', nextStep: '', nextStepDate: '', source: '', owner: '' });

  function load() {
    fetch('/api/prospect').then((r) => r.json()).then((j) => j.ok ? setD(j) : setErr(j.error)).catch((e) => setErr(String(e)));
  }
  useEffect(load, []);

  async function add() {
    setBusy(true); setErr('');
    const r = await fetch('/api/prospect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', ...f }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setAdding(false); setF({ name: '', market: 'Dubai', service: '', valueAed: '', nextStep: '', nextStepDate: '', source: '', owner: '' }); load(); }
    else setErr(j.error);
  }

  const items = d?.items || [];
  const open = items.filter((p) => !['won', 'lost'].includes(p.stage));
  const weighted = open.reduce((a, p) => a + Number(p.valueAed || 0), 0);
  const cold = open.filter(isCold);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Pitches and upsells</div>
          <h1>Pipeline</h1>
          <p className="lede">Open a prospect to move its live stage, update the next action, or record the outcome.</p>
        </div>
        {d?.canEdit ? <button className="btn dark" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add prospect'}</button> : null}
      </div>

      {adding ? <div className="panel">
        <header><h2>Add a prospect</h2></header>
        <div className="pad two-in" style={{ marginTop: 0 }}>
          <label><div className="fl">Prospect</div><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label><div className="fl">Market</div><select className="f" value={f.market} onChange={(e) => setF({ ...f, market: e.target.value })}>{['Dubai', 'GCC', 'India', 'Europe', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><div className="fl">Offer</div><input type="text" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} /></label>
          <label><div className="fl">AED per month</div><input type="text" value={f.valueAed} onChange={(e) => setF({ ...f, valueAed: e.target.value })} /></label>
          <label><div className="fl">Source</div><input type="text" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
          <label><div className="fl">Next action</div><input type="text" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} /></label>
          <label><div className="fl">When</div><input type="date" value={f.nextStepDate} onChange={(e) => setF({ ...f, nextStepDate: e.target.value })} /></label>
          <label><div className="fl">Owner</div><select className="f" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="">Me</option>{people.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
        </div>
        {err ? <div className="note" style={{ padding: '0 16px 12px', color: 'var(--bad)' }}>{err}</div> : null}
        <div className="pad" style={{ borderTop: '1px solid var(--line2)' }}><button className="btn dark" disabled={busy} onClick={add}>{busy ? 'Adding' : 'Add prospect'}</button></div>
      </div> : null}

      <div className="kpis">
        <div className="kpi"><div className="lbl">Open</div><div className="v">{open.length}</div><div className="n">{items.filter((p) => p.stage === 'won').length} won, {items.filter((p) => p.stage === 'lost').length} lost</div></div>
        <div className="kpi"><div className="lbl">In play</div><div className="v">{money(weighted)}</div><div className="n">per month if all open deals land</div></div>
        <div className="kpi"><div className="lbl">Liberty replacement target</div><div className="v sm">Not set</div><div className="n bad">no target field in the current API</div></div>
        <div className="kpi"><span className="d r" /><div className="lbl">No action 7 days</div><div className="v">{cold.length}</div><div className="n bad">overdue or missing a next date</div></div>
      </div>

      <div className="stepper" style={{ marginBottom: 13 }}>
        {['Intro made', 'First meeting', 'Discovery', 'Proposal sent', 'Quoted', 'Won', 'Lost'].map((s, i, all) => <div className="st" key={s}><div className="cir">{i + 1}</div>{i < all.length - 1 ? <div className="bar" /> : null}<div className="lb">{s}</div></div>)}
      </div>

      <div className="panel">
        <header><h2>All opportunities</h2><span className="hint">sorted by next action</span></header>
        <table>
          <thead><tr><th>Prospect</th><th>Market</th><th>Offer</th><th className="num">AED per month</th><th>Stage</th><th>Next action</th><th>When</th><th /></tr></thead>
          <tbody>
            {items.map((p) => {
              const stage = STAGE[p.stage] || ['Not set', 'mute'];
              return <tr key={p._id} className={isCold(p) && !['won', 'lost'].includes(p.stage) ? 'flag' : ''}>
                <td className="b">{p.name}<div className="sub2">{p.ownerName || 'No owner'}</div></td>
                <td className="dim">{p.market}</td><td className="dim">{p.service || 'Not defined'}</td>
                <td className="num">{Number(p.valueAed || 0).toLocaleString('en-GB')}</td>
                <td><span className={'tag ' + stage[1]}>{stage[0]}</span></td>
                <td>{p.nextStep || <span className="dim">Nothing planned</span>}</td>
                <td className="dim">{dayOf(p.nextStepDate)}</td>
                <td><Link className="btn sm" href={'/pipeline/' + encodeURIComponent(p._id)}>Open</Link></td>
              </tr>;
            })}
            {items.length === 0 ? <tr><td colSpan={8} className="dim">Nothing in the pipeline yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {!d && !err ? <div className="panel"><div className="pad note">Loading the pipeline.</div></div> : null}
      {err && !adding ? <div className="alertbar">{err}</div> : null}
          </>
  );
}
