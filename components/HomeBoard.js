'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const STEP = {
  approved: ['ok', 'approved'], withClient: ['warn', 'with client'], incomplete: ['bad', 'incomplete'],
  inProgress: ['info', 'in progress'], current: ['info', 'this week'], nothing: ['mute', 'not started'],
  future: ['mute', 'ahead'],
};
const when = (t) => (t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

export default function HomeBoard({ startWeek }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/home?week=' + startWeek).then((r) => r.json())
      .then((j) => (j.ok ? setD(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  }, [startWeek]);

  function copy() {
    const text = 'CN operations, ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
      + '\n\n' + d.digest.map((l) => '• ' + l).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (err) return <div className="alert">Could not read the operations picture. <code>{err}</code></div>;
  if (!d) return <div className="panel"><div className="empty">Opening the calendars. A few seconds the first time, then it is quick.</div></div>;

  return (
    <>
      <div className="kpis">
        {d.kpis.map((k) => (
          <div className="kpi" key={k.label}>
            {k.bad ? <span className="d r" /> : null}
            <div className="lbl">{k.label}</div>
            <div className="v" style={{ color: k.bad && k.value ? 'var(--bad)' : undefined }}>{k.value}</div>
            <div className={'n' + (k.bad ? ' bad' : ' good')}>{k.note}</div>
          </div>))}
      </div>

      <div className="panel">
        <header>
          <div><h2>This month</h2><div className="sub2">Where every account sits in the monthly rhythm.</div></div>
          <span className="pill">{d.monthLabel}</span>
        </header>
        <div className="pad">
          {d.rhythm.map((r) => (
            <div key={r.slug} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                {r.steps.map((s, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link href={'/projects/' + r.slug + '/review'} className={'tag ' + STEP[s.state][0]}
                      title={STEP[s.state][1]} style={{ textDecoration: 'none' }}>{s.label}</Link>
                    {i < r.steps.length - 1 ? <span style={{ color: 'var(--faint)' }}>›</span> : null}
                  </span>))}
              </div>
            </div>))}
          {d.rhythm.length === 0 ? <span className="dim">No social projects.</span> : null}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <header>
            <div><h2>Needs attention</h2><div className="sub2">Worst consequence first, not newest first.</div></div>
          </header>
          {d.attention.map((a, i) => (
            <div className="row" key={i}>
              <span className={'dot ' + (a.rank <= 2 ? 'no' : 'ok')} />
              <div className="t">
                <span className="lbl">{a.kind}</span>
                <b>{a.text}</b>
                <span>{a.sub}</span>
              </div>
              <Link className="btn sm" href={a.href}>{a.action}</Link>
            </div>))}
          {d.attention.length === 0 ? <div className="empty">Nothing needs you.</div> : null}
        </div>

        <div className="panel">
          <header>
            <div><h2>Today's digest</h2><div className="sub2">Paste this into the team group.</div></div>
            <button className="btn sm dark" onClick={copy}>{copied ? 'Copied' : 'Copy it'}</button>
          </header>
          <div className="pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {d.digest.map((l, i) => (
              <div key={i} style={{ fontSize: 13, padding: '7px 0', borderBottom: i < d.digest.length - 1 ? '1px solid var(--line2)' : 'none' }}>{l}</div>))}
          </div>
          <div style={{ padding: '11px 15px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            Every line names a person and the actual thing, computed from the calendars and the sign offs.
            Nothing here is typed by hand and nothing is sent automatically.
            {d.readAt ? ' Calendars read at ' + when(d.readAt) + '.' : ''}
          </div>
        </div>
      </div>

      <div className="panel">
        <header><h2>This week, by account</h2><span className="pill">week of {startWeek}</span></header>
        <table className="tbl">
          <thead><tr><th>Account</th><th style={{ width: 110 }}>Owner</th><th style={{ width: 80 }}>Posts</th><th style={{ width: 90 }}>Pending</th><th>What is missing</th></tr></thead>
          <tbody>
            {d.gapRows.map((r) => (
              <tr key={r.slug}>
                <td><Link href={'/projects/' + r.slug + '/review'}>{r.client}</Link></td>
                <td className="dim">{r.owner || '—'}</td>
                <td className="num">{r.total}</td>
                <td>{r.error ? <span className="tag bad">unreadable</span>
                  : r.pending ? <span className="tag bad">{r.pending}</span> : <span className="tag ok">clear</span>}</td>
                <td>
                  {r.error ? <span style={{ color: 'var(--bad)' }}>{r.error}</span>
                    : r.gaps.length === 0 ? <span className="dim">Nothing outstanding</span>
                    : r.gaps.map((g, i) => (
                        <div key={i} style={{ fontSize: 12.5 }}>
                          <span className="mono dim">{g.date || '?'}</span> {g.type || g.title || 'post'}{' '}
                          <span className="tag warn">no {(g.missing || []).join(' and no ')}</span>
                        </div>))}
                </td>
              </tr>))}
            {d.gapRows.length === 0 ? <tr><td colSpan={5} className="empty">No linked calendars.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
