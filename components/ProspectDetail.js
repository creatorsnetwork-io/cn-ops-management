'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const STAGES = ['Intro made', 'First meeting', 'Discovery', 'Proposal sent', 'Quoted', 'Won', 'Lost'];
const INDEX = { lead: 0, talking: 2, proposal: 3, won: 5, lost: 6 };
const NEXT = { lead: 'talking', talking: 'proposal', proposal: 'won' };
const dayOf = (d) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'Not set';

export default function ProspectDetail({ id }) {
  const [data, setData] = useState(null);
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState({ notes: '', nextStep: '', nextStepDate: '' });

  function load() {
    fetch('/api/prospect').then((r) => r.json()).then((j) => {
      if (!j.ok) { setErr(j.error); return; }
      const item = (j.items || []).find((x) => x._id === id);
      setData(j); setP(item || null);
      if (item) setEdit({ notes: item.notes || '', nextStep: item.nextStep || '', nextStepDate: item.nextStepDate || '' });
      else setErr('That prospect was not found.');
    }).catch((e) => setErr(String(e)));
  }
  useEffect(load, [id]);

  async function post(body) {
    setBusy(true); setErr('');
    const r = await fetch('/api/prospect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setMode(''); setNote(''); load(); } else setErr(j.error);
  }

  if (!p) return <><Link className="btn sm" href="/pipeline">Back to pipeline</Link>{err ? <div className="alertbar">{err}</div> : <div className="panel"><div className="pad note">Loading prospect.</div></div>}</>;
  const idx = INDEX[p.stage] ?? 0;
  const next = NEXT[p.stage];

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">Prospect</div><h1>{p.name}</h1><p className="lede">{p.market} · {p.service || 'Offer not defined'} · AED {Number(p.valueAed || 0).toLocaleString('en-GB')} per month</p></div>
        <div className="rowb">
          <Link className="btn" href="/pipeline">Back</Link>
          {data?.canEdit && next ? <button className="btn" onClick={() => next === 'won' ? setMode('won') : post({ action: 'stage', stage: next })}>Advance stage</button> : null}
          {data?.canEdit && !['won', 'lost'].includes(p.stage) ? <button className="btn dark" onClick={() => setMode('won')}>Mark won</button> : null}
          {data?.canEdit && !['won', 'lost'].includes(p.stage) ? <button className="btn" onClick={() => setMode('lost')}>Mark lost</button> : null}
          {data?.canEdit && ['won', 'lost'].includes(p.stage) ? <button className="btn" onClick={() => post({ action: 'stage', stage: 'talking' })}>Reopen</button> : null}
        </div>
      </div>

      {mode === 'won' || mode === 'lost' ? <div className="panel"><header><h2>{mode === 'won' ? 'Record what they signed' : 'Record why it was lost'}</h2></header><div className="pad"><textarea value={note} onChange={(e) => setNote(e.target.value)} /><div className="rowb" style={{ marginTop: 10 }}><button className="btn dark" disabled={busy} onClick={() => post({ action: 'stage', stage: mode, note })}>Save outcome</button><button className="btn" onClick={() => setMode('')}>Cancel</button></div></div></div> : null}

      {err ? <div className="alertbar">{err}</div> : null}

      <div className="panel"><header><h2>Stage</h2></header><div className="stepper">{STAGES.map((s, i) => <div className={'st ' + (i < idx ? 'done' : i === idx ? 'now' : '')} key={s}><div className="cir">{i < idx ? '✓' : i + 1}</div><div className="bar" /><div className="lb">{s}</div></div>)}</div><div className="pad" style={{ borderTop: '1px solid var(--line2)' }}><p className="note">First meeting and Quoted are not separate values in the live API, so advancing follows its five stored states.</p></div></div>

      <div className="grid2">
        <div className="panel"><header><h2>Notes</h2></header><div className="pad">
          <textarea value={edit.notes} disabled={!data?.canEdit} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Prospect notes" />
          <div className="two-in"><label><div className="fl">Next action</div><input type="text" value={edit.nextStep} disabled={!data?.canEdit} onChange={(e) => setEdit({ ...edit, nextStep: e.target.value })} /></label><label><div className="fl">When</div><input type="date" value={edit.nextStepDate} disabled={!data?.canEdit} onChange={(e) => setEdit({ ...edit, nextStepDate: e.target.value })} /></label></div>
          <div className="ref"><div className="rl">Current next action</div><div className="rc">{p.nextStep || 'Nothing planned'} · {dayOf(p.nextStepDate)}</div></div>
          <div className="rowb" style={{ marginTop: 12 }}>{data?.canEdit ? <button className="btn sm" disabled={busy} onClick={() => post({ action: 'edit', ...edit })}>Save notes and next action</button> : null}<button className="btn sm" disabled title="No proposal-generation endpoint exists">Generate proposal</button></div>
        </div></div>
        <div className="panel"><header><h2>What happens if you win</h2></header><table><tbody>
          <tr><td className="b" style={{ width: 150 }}>Pipeline record</td><td className="dim">Outcome and decision time are stored</td></tr>
          <tr><td className="b">Client record</td><td className="dim">Not automated by the current API</td></tr>
          <tr><td className="b">Project record</td><td className="dim">Not automated by the current API</td></tr>
          <tr><td className="b">Onboarding</td><td className="dim">Not automated by the current API</td></tr>
          <tr><td className="b">Drive and obligations</td><td className="dim">Not automated by the current API</td></tr>
        </tbody></table></div>
      </div>
    </>
  );
}
