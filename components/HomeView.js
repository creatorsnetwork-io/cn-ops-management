'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WeekBoard from './WeekBoard';
import Raise from './Raise';
import { LABEL, TAG, isLate } from '../lib/work';

const HEADS = {
  aashif: ['Delivery operations', 'Operations today',
    'What is moving, what is blocked, what needs stepping into. Ordered by delivery risk, not by who asked last.'],
  priyanka: ['Accounts you lead', 'My accounts',
    'Where each account sits this month, what is with the client, and what needs a decision from you.'],
  shelly: ['Creative', 'Work waiting on you',
    'What is sitting at the craft gate, and what came back with changes.'],
};
const DEFAULT_HEAD = ['Operations, without the hunt',
  'Clients, contracted deliverables and live production in one place. Working files stay in Drive and Sheets.'];

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function Kpi({ label, value, note, tone, dot }) {
  return (
    <div className="kpi">
      {dot ? <span className={'d ' + dot} /> : null}
      <div className="lbl">{label}</div>
      <div className="v">{value}</div>
      <div className={'n' + (tone ? ' ' + tone : '')}>{note}</div>
    </div>);
}

function Digest({ lines, monthName }) {
  const [copied, setCopied] = useState(false);
  const text = 'CN Ops, ' + today() + '\n\n' + lines.map((l) => '• ' + l).join('\n');

  return (
    <div className="panel">
      <header>
        <div>
          <h2>Today's digest</h2>
          <div className="sub2">Copy it into the team group. Nothing is sent automatically.</div>
        </div>
        <button className="btn sm dark" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
          {copied ? 'Copied' : 'Copy for WhatsApp'}
        </button>
      </header>
      <div className="pad">
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 13, padding: '5px 0', borderBottom: i === lines.length - 1 ? 'none' : '1px solid var(--line2)' }}>{l}</div>))}
        <p className="note" style={{ marginTop: 11 }}>
          Every line is counted from the portal, so it cannot drift from what is actually true.
          Nobody types it and nobody is pinged per event.
        </p>
      </div>
    </div>);
}

function Cycle({ rows, monthName, canMark, onMarked }) {
  const [busy, setBusy] = useState('');

  async function mark(slug, step) {
    setBusy(slug + step);
    await fetch('/api/cycle', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, action: 'mark', step }),
    });
    setBusy('');
    if (onMarked) onMarked();
  }

  return (
    <div className="panel">
      <header>
        <div>
          <h2>This month</h2>
          <div className="sub2">Where every account sits in the monthly rhythm, in your own steps.</div>
        </div>
        <span className="badge">{monthName}</span>
      </header>
      <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {rows.map((r) => (
          <div key={r.slug}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                <Link href={'/projects/' + r.slug}>{r.client}</Link>
              </div>
              {canMark && r.steps[0][1] === '' ? (
                <button className="btn sm" disabled={busy === r.slug + 'brainstorm'} onClick={() => mark(r.slug, 'brainstorm')}>
                  Brainstorm held
                </button>) : null}
              {canMark && r.steps[0][1] === 'done' && r.steps[1][1] === '' ? (
                <span className="rowb">
                  <button className="btn sm" disabled={busy === r.slug + 'ideasWith'} onClick={() => mark(r.slug, 'ideasWith')}>Ideas sent</button>
                  <button className="btn sm" disabled={busy === r.slug + 'ideas'} onClick={() => mark(r.slug, 'ideas')}>Ideas approved</button>
                </span>) : null}
              {canMark && r.steps[1][1] === 'wait' ? (
                <button className="btn sm" disabled={busy === r.slug + 'ideas'} onClick={() => mark(r.slug, 'ideas')}>Ideas approved</button>) : null}
            </div>
            <div className="cyc">
              {r.steps.map((s, i) => (
                <span key={i}>
                  <span className={'step ' + s[1]}>{s[0]}</span>
                  {i < r.steps.length - 1 ? <span className="arw"> › </span> : null}
                </span>))}
            </div>
          </div>))}
        {rows.length === 0 ? <div style={{ fontSize: 13, color: 'var(--faint)' }}>No social retainers yet.</div> : null}
      </div>
    </div>);
}

export default function HomeView({ d, firstName }) {
  const [gaps, setGaps] = useState(null);
  const head = HEADS[d.who] || [today(), ...DEFAULT_HEAD];
  const named = HEADS[d.who] ? head : [today(), DEFAULT_HEAD[0], DEFAULT_HEAD[1]];

  // The calendar gap number needs the live sheets, so it arrives a moment later
  // rather than holding the whole page up.
  useEffect(() => {
    if (!d.canSeeCalendars) return;
    fetch('/api/week?week=' + d.week).then((r) => r.json())
      .then((j) => j.ok && setGaps(j.totals.pending)).catch(() => {});
  }, [d.week, d.canSeeCalendars]);

  return (
    <>
      <div className="head">
        <div>
          <div className={'eyebrow' + (HEADS[d.who] ? '' : ' n')}>{named[0]}</div>
          <h1>{named[1]}</h1>
          <p className="lede">{named[2]}</p>
        </div>
        <div className="rowb">
          <Link className="btn" href="/work">All work</Link>
          <Link className="btn dark" href="/requests">Log a request</Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Yours today" value={d.kpi.mine} note="assigned to you" />
        <Kpi label="At a gate" value={d.kpi.atGate} dot={d.kpi.atGate ? 'a' : 'g'}
          note={d.kpi.atGate ? 'waiting on a signature' : 'nothing waiting'} tone={d.kpi.atGate ? '' : 'good'} />
        <Kpi label="Calendar gaps" value={gaps == null ? (d.canSeeCalendars ? '…' : '—') : gaps}
          dot={gaps ? 'a' : gaps === 0 ? 'g' : null}
          note={gaps == null ? (d.canSeeCalendars ? 'reading the sheets' : 'not your screen') : gaps ? 'this week, across all clients' : 'this week is clear'}
          tone={gaps === 0 ? 'good' : ''} />
        <Kpi label="Decisions open" value={d.kpi.decisions} dot={d.kpi.decisions ? 'r' : 'g'}
          note={d.kpi.decisions ? 'somebody is waiting' : 'nobody is waiting'} tone={d.kpi.decisions ? 'bad' : 'good'} />
      </div>

      {d.kpi.late ? (
        <div className="alertbar">
          <span><b>{d.kpi.late} piece{d.kpi.late === 1 ? '' : 's'} of work past its date.</b> A date that has passed does not move on its own.</span>
          <Link className="btn sm" href="/work">Open</Link>
        </div>) : null}

      {d.escalations.length ? (
        <div className="panel">
          <header><h2>Sitting with you</h2><span className="tag bad">{d.escalations.length}</span></header>
          {d.escalations.map((e) => (
            <div className="row" key={e._id}>
              <span className="dot no" />
              <div className="t"><b>{e.reason}</b>
                <span>{e.projectName ? e.projectName + ' · ' : ''}raised by {e.raisedBy}{e.detail ? ' · ' + e.detail : ''}</span></div>
              <Link className="btn sm" href="/escalations">Decide</Link>
            </div>))}
        </div>) : null}

      <Cycle rows={d.cycle} monthName={d.monthName} canMark={['himanshu', 'aashif', 'priyanka'].includes(d.who)}
        onMarked={() => window.location.reload()} />

      <div className="grid2">
        <div className="panel">
          <header>
            <div><h2>Needs attention</h2><div className="sub2">Ordered by what it costs to ignore.</div></div>
          </header>
          {d.attention.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 15px', borderBottom: '1px solid var(--line2)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flex: '0 0 7px', background: 'var(--' + (a.dot === 'bad' ? 'bad' : a.dot === 'warn' ? 'warn' : 'teal') + ')' }} />
              <div style={{ flex: 1 }}>
                <div className="lbl">{a.k}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{a.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.s}</div>
              </div>
              <Link className="btn sm" href={a.href}>{a.btn}</Link>
            </div>))}
          {d.attention.length === 0 ? (
            <div className="pad" style={{ fontSize: 13, color: 'var(--muted)' }}>
              Nothing needs you. Every gate is signed, no dates have passed and nobody is waiting on a decision.
            </div>) : null}
        </div>

        <Digest lines={d.digest} monthName={d.monthName} />
      </div>

      {d.myWork.length ? (
        <div className="panel">
          <header><h2>Your work</h2><Link className="btn sm" href="/work">All of it</Link></header>
          <table className="tbl">
            <thead><tr><th>What</th><th style={{ width: 170 }}>Project</th><th style={{ width: 92 }}>Due</th><th style={{ width: 128 }}>State</th></tr></thead>
            <tbody>
              {d.myWork.map((w) => (
                <tr key={w._id}>
                  <td><Link href={'/work/' + w._id}>{w.title}</Link></td>
                  <td className="dim">{w.projectName}</td>
                  <td className="mono">{w.due || '—'}{isLate(w) ? <div><span className="tag bad">late</span></div> : null}</td>
                  <td><span className={'tag ' + (TAG[w.state] || 'mute')}>{LABEL[w.state]}</span></td>
                </tr>))}
            </tbody>
          </table>
        </div>) : null}

      {d.canSeeCalendars ? <WeekBoard startWeek={d.week} /> : null}

      <Raise leadName={null} label="I need a decision on something" />
    </>
  );
}
