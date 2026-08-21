'use client';
import { useEffect, useState } from 'react';

const monthName = (m) => (m === 'undated' ? 'No date' : new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }));

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function CountReport({ slug }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function load(force) {
    setErr(''); if (force) setBusy(true); else setD(null);
    fetch('/api/count?slug=' + slug + (force ? '&force=1' : ''))
      .then((r) => r.json())
      .then((j) => { setBusy(false); j.ok ? setD(j) : setErr(j.error); })
      .catch((e) => { setBusy(false); setErr(String(e)); });
  }
  useEffect(() => { load(false); }, [slug]);

  if (err) return <div className="panel"><div className="row"><span className="dot no" /><div className="t"><b>Could not count</b><span className="err">{err}</span></div></div></div>;
  if (!d) return <div className="panel"><div className="empty">Opening every calendar linked to this project. This is slow the first time, then it is instant.</div></div>;

  const months = Object.keys(d.months).sort();

  return (
    <>
      <div className="panel">
        <header>
          <h2>Everything in every calendar</h2>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="pill">{d.sources.length} calendar{d.sources.length === 1 ? '' : 's'}</span>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>
              counted {when(d.countedAt)}{d.countedBy ? ' by ' + d.countedBy : ''}
            </span>
            <button className="btn sm" disabled={busy} onClick={() => load(true)}>{busy ? 'Counting' : 'Recount'}</button>
          </span>
        </header>
        <div style={{ padding: '14px 16px' }}>
          <div className="stat">
            <div><b>{d.totals.posts}</b><span>posts in the sheets</span></div>
            <div><b style={{ color: 'var(--ok)' }}>{d.totals.complete}</b><span>complete</span></div>
            <div><b>{d.totals.withCaption}</b><span>have a caption</span></div>
            <div><b>{d.totals.withCreative}</b><span>have a creative</span></div>
          </div>
          {(d.deliverables || []).length ? (
            <p className="note" style={{ marginTop: 10 }}>
              Contracted: {(d.deliverables || []).map((x) => x.name + ' ' + x.target + ' per ' + x.period).join(', ')}.
              This page counts what is in the calendars, which is not the same as what the client approved.
              Approvals are on the record of approvals.
            </p>) : null}
        </div>
      </div>

      <div className="panel">
        <header><h2>By month</h2></header>
        <table className="tbl">
          <thead><tr><th style={{ width: 150 }}>Month</th><th>Posts</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m}><td>{monthName(m)}</td><td><b>{d.months[m]}</b></td></tr>))}
            {months.length === 0 ? <tr><td colSpan={2} className="empty">Nothing dated.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {d.sources.map((s) => (
        <div className="panel" key={s.sheetId + s.label}>
          <header>
            <h2>{s.label}{s.year ? ', ' + s.year : ''}</h2>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {s.current ? <span className="tag ok">in use</span> : <span className="tag mute">kept for history</span>}
              <a className="btn sm" target="_blank" rel="noreferrer" href={'https://docs.google.com/spreadsheets/d/' + s.sheetId}>Open</a>
            </span>
          </header>
          {s.error ? <div className="row"><span className="dot no" /><div className="t"><b>Could not read it</b><span className="err">{s.error}</span></div></div> : null}
          <table className="tbl">
            <thead><tr><th>Tab</th><th style={{ width: 80 }}>Posts</th><th style={{ width: 90 }}>Complete</th><th style={{ width: 90 }}>Captions</th><th style={{ width: 90 }}>Creatives</th><th style={{ width: 90 }}>Links</th></tr></thead>
            <tbody>
              {s.tabs.map((t, i) => (
                <tr key={i}>
                  <td>{t.tab}{t.skipped ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>{t.skipped}</div> : null}
                    {t.error ? <div style={{ color: 'var(--bad)', fontSize: 12 }}>{t.error}</div> : null}</td>
                  <td>{t.posts != null ? <b>{t.posts}</b> : '—'}</td>
                  <td>{t.complete != null ? t.complete : '—'}</td>
                  <td>{t.withCaption != null ? t.withCaption : '—'}</td>
                  <td>{t.withCreative != null ? t.withCreative : '—'}</td>
                  <td>{t.withLink != null ? t.withLink : '—'}</td>
                </tr>))}
            </tbody>
          </table>
        </div>))}

      <p className="note">
        Counted from the sheets, every year linked to this project, including years kept for history.
        The answer is stored so the page opens instantly. Press Recount to read the sheets again.
      </p>
    </>
  );
}
