'use client';
import { Fragment, useEffect, useState } from 'react';

function pretty(w, showYear) {
  if (!w) return '';
  const a = new Date(w + 'T00:00:00Z'), b = new Date(w + 'T00:00:00Z');
  b.setUTCDate(b.getUTCDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return f(a) + ' to ' + f(b) + (showYear ? ' ' + a.getUTCFullYear() : '');
}
const FIELD_LABEL = { date:'Date', channel:'Channel', type:'Format', title:'Idea', caption:'Caption', creative:'Creative', status:'Status', approval:'Approval', remarks:'Remarks' };
const isUrl = (t) => /^https?:\/\/\S+$/.test(String(t || '').trim());
const stop = (e) => e.stopPropagation();

function Copy({ text }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button className="btn sm" onClick={(e) => { stop(e); navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function Tracker({ sources }) {
  const live = sources.filter((s) => s.current);
  const [src, setSrc] = useState((live[0] || sources[0] || {})._key || '');
  const [tab, setTab] = useState('');
  const [week, setWeek] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [scope, setScope] = useState('week');
  const [open, setOpen] = useState(null);

  const source = sources.find((s) => s._key === src) || sources[0];

  useEffect(() => { setTab(''); setWeek(''); }, [src]);
  useEffect(() => { setOpen(null); }, [tab, week, scope]);

  useEffect(() => {
    if (!source) return;
    let ok = true;
    setD(null); setErr(null);
    const u = new URL('/api/calendar', window.location.origin);
    u.searchParams.set('sheetId', source.sheetId);
    if (source.year) u.searchParams.set('year', source.year);
    if (tab) u.searchParams.set('tab', tab);
    if (week) u.searchParams.set('week', week);
    fetch(u).then((r) => r.json()).then((j) => {
      if (!ok) return;
      if (j.ok) { setD(j); if (!tab) setTab(j.tab); if (!week && j.week) setWeek(j.week); }
      else setErr(j.error);
    }).catch((e) => ok && setErr(String(e)));
    return () => { ok = false; };
  }, [src, tab, week, source && source.sheetId]);

  if (!source) return <div className="panel"><div className="empty">No calendar linked to this project yet. Add one on the Overview tab.</div></div>;

  const items = d ? (scope === 'week' ? d.items.filter((i) => i.week === d.week) : scope === 'pending' ? d.items.filter((i) => i.pending) : d.items) : [];

  return (
    <>
      <div className="panel">
        <header>
          <h2>{d ? d.sheetTitle : 'Reading the sheet'}</h2>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sources.length > 1 ? (
              <select className="inp" style={{ width: 'auto' }} value={src} onChange={(e) => setSrc(e.target.value)}>
                {sources.map((s) => <option key={s._key} value={s._key}>{s.label}{s.current ? '' : ' (old)'}</option>)}
              </select>) : null}
            {d ? (
              <select className="inp" style={{ width: 'auto' }} value={tab} onChange={(e) => { setTab(e.target.value); setWeek(''); }}>
                {d.tabs.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>) : null}
            {d && d.weeks.length ? (
              <select className="inp" style={{ width: 'auto' }} value={week} onChange={(e) => setWeek(e.target.value)}>
                {d.weeks.map((w) => <option key={w.week} value={w.week}>{pretty(w.week, w.week.slice(0, 4) !== String(source.year))} ({w.count})</option>)}
              </select>) : null}
            <a className="btn sm" target="_blank" rel="noreferrer" href={'https://docs.google.com/spreadsheets/d/' + source.sheetId}>Open in Sheets</a>
          </span>
        </header>

        {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not read this sheet</b><span className="err">{err}</span></div></div> : null}
        {!d && !err ? <div className="empty">Reading the sheet.</div> : null}
        {d && d.reason ? <div className="row"><span className="dot no" /><div className="t"><b>Could not make sense of the layout</b><span className="err">{d.reason} Pick a different tab above.</span></div></div> : null}

        {d && !d.reason ? (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
              <div className="stat">
                <div><b>{d.summary.total}</b><span>this week</span></div>
                <div><b>{d.summary.ready}</b><span>complete</span></div>
                <div><b style={{ color: d.summary.pending ? 'var(--bad)' : 'var(--ok)' }}>{d.summary.pending}</b><span>pending</span></div>
                <div><b>{d.summary.noCaption}</b><span>no caption</span></div>
                <div><b>{d.summary.noCreative}</b><span>no creative</span></div>
                <div><b>{d.summary.partial}</b><span>part written</span></div>
                <div><b>{d.overall.total}</b><span>in this tab</span></div>
              </div>
            </div>
            <div className="tabs" style={{ margin: 0, padding: '0 10px' }}>
              <button className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>This week ({d.summary.total})</button>
              <button className={scope === 'pending' ? 'on' : ''} onClick={() => setScope('pending')}>All pending ({d.overall.pending})</button>
              <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Whole tab ({d.overall.total})</button>
            </div>
            <table className="tbl">
              <thead><tr>
                <th style={{ width: 84 }}>Date</th><th style={{ width: 118 }}>Channel or format</th><th>Idea</th>
                <th style={{ width: 200 }}>Caption</th><th>Creative</th><th style={{ width: 116 }}>State</th><th style={{ width: 46 }}>Row</th>
              </tr></thead>
              <tbody>
                {items.map((i, n) => (
                  <Fragment key={n}>
                    <tr onClick={() => setOpen(open === n ? null : n)} style={{ cursor: 'pointer', background: open === n ? 'var(--head)' : undefined }}>
                      <td className="mono">{i.date || i.dateRaw || '—'}</td>
                      <td>{i.channel || (i.channels && i.channels.length ? i.channels.join(', ') : '') || i.type || '\u2014'}
                        {i.type && (i.channel || (i.channels && i.channels.length)) ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>{i.type}</div> : null}</td>
                      <td>{i.title || '—'}
                        {i.remarks ? <div style={{ color: 'var(--warn)', fontSize: 12 }}>{i.remarks}</div> : null}</td>
                      <td>
                        {i.captions && i.captions.length > 1 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {i.captions.map((c, k) => (
                              <span key={k} className={'tag ' + (c.has ? 'ok' : 'warn')}>{c.channel}</span>
                            ))}
                          </div>
                        ) : i.hasCaption ? <span className="tag ok">written</span> : <span className="tag warn">nothing written</span>}
                      </td>
                      <td>{i.creativeLink
                        ? <a href={i.creativeLink} target="_blank" rel="noreferrer" onClick={stop}>{i.creativeText || 'open file'}</a>
                        : i.creativeText
                          ? i.creativeText
                          : <span className="tag warn">missing</span>}</td>
                      <td>{i.pending ? <span className="tag bad">pending</span> : <span className="tag ok">complete</span>}
                        {i.status ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>{i.status}</div> : null}</td>
                      <td className="mono" style={{ color: 'var(--faint)' }}>{i.sheetRow}</td>
                    </tr>
                    {open === n ? (
                      <tr>
                        <td colSpan={7} style={{ background: '#FCFDFE', borderBottom: '2px solid var(--line)' }}>
                          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                            {(i.captions || []).map((c, k) => (
                              <div key={k}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                  <span className="k" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>{c.channel}</span>
                                  {c.has && !isUrl(c.text) ? <Copy text={c.text} /> : null}
                                </div>
                                {!c.has ? <span className="tag warn">nothing written</span>
                                  : isUrl(c.text)
                                    ? <a href={c.text.trim()} target="_blank" rel="noreferrer" onClick={stop}>Open the document</a>
                                    : <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--ink)', background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}>{c.text}</div>}
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 13, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
                            <span>Sheet row <b>{i.sheetRow}</b></span>
                            {i.creativeLink ? <a href={i.creativeLink} target="_blank" rel="noreferrer" onClick={stop}>Open the creative</a> : <span className="tag warn">no creative link</span>}
                            {i.status ? <span>Status: {i.status}</span> : null}
                            {i.approval ? <span>Approval: {i.approval}</span> : null}
                            {i.remarks ? <span style={{ color: 'var(--warn)' }}>Remarks: {i.remarks}</span> : null}
                            {i.capMissing && i.capMissing.length ? <span style={{ color: 'var(--warn)' }}>Still to write: {i.capMissing.join(', ')}</span> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
                {items.length === 0 ? <tr><td colSpan={7} className="empty">Nothing in this view.</td></tr> : null}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
              Click any row to read the full captions for every channel.
            </div>
          </>
        ) : null}
      </div>

      {d && d.mappedNames ? (
        <div className="panel">
          <header><h2>How this sheet was read</h2><span className="pill">header on row {d.headerRow + 1}</span></header>
          <div style={{ padding: '13px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {Object.keys(FIELD_LABEL).map((f) => (
              <div key={f} style={{ fontSize: 12.5 }}>
                <span style={{ color: 'var(--faint)' }}>{FIELD_LABEL[f]}</span><br />
                {d.mappedNames[f] ? <b>{d.mappedNames[f]}</b> : <span className="tag mute">not found</span>}
              </div>
            ))}
          </div>
          <div style={{ padding: '13px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5 }}>
            <span style={{ color: 'var(--faint)' }}>Caption columns</span>{' '}
            {(d.captionCols || []).length
              ? (d.captionCols || []).map((c) => <span key={c.col} className="pill" style={{ marginRight: 6 }}>{c.header}</span>)
              : <span className="tag warn">none found</span>}
            {(d.flagCols || []).length ? (<>
              <div style={{ marginTop: 9 }} />
              <span style={{ color: 'var(--faint)' }}>Read as channel ticks, not captions</span>{' '}
              {(d.flagCols || []).map((c) => <span key={c.col} className="pill" style={{ marginRight: 6 }}>{c.header}</span>)}
            </>) : null}
            <div style={{ marginTop: 9 }} />
            <span style={{ color: 'var(--faint)' }}>Reading links from</span>{' '}
            <b>{d.mappedNames.creative || 'no creative column found'}</b>{' '}
            <span className="pill" style={{ marginLeft: 6 }}>
              {d.items.filter((x) => x.creativeLink).length} of {d.items.filter((x) => x.creativeText).length} filled cells carry a link
            </span>
          </div>
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            The column names came from your sheet, they were not renamed. If one says not found and it
            matters, tell me the exact header text and I will teach the reader that name.
          </div>
        </div>
      ) : null}
    </>
  );
}
