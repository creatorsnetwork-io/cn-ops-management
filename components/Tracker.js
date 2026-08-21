'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';

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
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not read yet');

function exactGap(item) {
  const gaps = [];
  if (!item.hasCaption) gaps.push('Caption missing');
  else if (item.capMissing && item.capMissing.length) gaps.push('Missing ' + item.capMissing.join(', '));
  if (!item.hasCreative) gaps.push('Creative missing');
  return gaps.join(' · ');
}

function Copy({ text }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button className="btn sm" onClick={(e) => { stop(e); navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function Tracker({ sources, project, canShare }) {
  const live = sources.filter((s) => s.current);
  const [src, setSrc] = useState((live[0] || sources[0] || {})._key || '');
  const [tab, setTab] = useState('');
  const [week, setWeek] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [scope, setScope] = useState('week');
  const [open, setOpen] = useState(null);
  const [check, setCheck] = useState({ tick: 0, row: null });
  const [lastRow, setLastRow] = useState(null);

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
    if (check.tick) u.searchParams.set('force', '1');
    fetch(u).then((r) => r.json()).then((j) => {
      if (!ok) return;
      if (j.ok) {
        setD(j); if (!tab) setTab(j.tab); if (!week && j.week) setWeek(j.week);
        if (check.row) setLastRow(check.row);
      }
      else setErr(j.error);
    }).catch((e) => ok && setErr(String(e)));
    return () => { ok = false; };
  }, [src, tab, week, source && source.sheetId, check.tick]);

  if (!source) return <div className="panel"><div className="pad note">No calendar linked to this project yet. Add one on the Overview tab.</div></div>;

  const items = d ? (scope === 'week' ? d.items.filter((i) => i.week === d.week) : scope === 'pending' ? d.items.filter((i) => i.pending || i.partial) : d.items) : [];
  const currentWeek = d ? d.items.filter((i) => i.week === d.week) : [];
  const openGaps = currentWeek.filter((i) => i.pending || i.partial).length;
  const recheck = (row) => { setLastRow(null); setCheck((c) => ({ tick: c.tick + 1, row: row || null })); };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Internal calendar health</div>
          <h1>{d ? openGaps + ' exact gap' + (openGaps === 1 ? '' : 's') + ' in ' + project.client : project.client}</h1>
          <p className="lede">Read only. Pending comes from empty cells. Fix the source sheet, then recheck the row or the whole week.</p>
        </div>
        <div className="rowb">
          {canShare && d && d.week ? <Link className="btn" href={'/projects/' + project.slug + '/review?week=' + d.week}>Share client link</Link> : null}
          <a className="btn" target="_blank" rel="noreferrer" href={'https://docs.google.com/spreadsheets/d/' + source.sheetId}>Open sheet</a>
          <button className="btn ai" disabled={!d} onClick={() => recheck(null)}>✦ Recheck all rows</button>
        </div>
      </div>

      <div className="panel">
        {d ? <div className="trust"><span>Last read <b>{when(d.readAt)}</b></span><span>Rows checked <b>{d.summary.total}</b></span>
          <span>Complete <b>{Math.max(0, d.summary.total - openGaps)}</b></span><span>Gaps <b>{openGaps}</b></span><span className="sp badge">Read only</span></div> : null}
        <header>
          <div><h2>{d ? project.client + ', ' + pretty(d.week, true) : 'Reading the sheet'}</h2>
            <div className="sub2">{d ? d.sheetTitle + ', tab ' + d.tab : project.name}</div></div>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sources.length > 1 ? (
              <select className="f" style={{ width: 'auto' }} value={src} onChange={(e) => setSrc(e.target.value)}>
                {sources.map((s) => <option key={s._key} value={s._key}>{s.label}{s.current ? '' : ' (old)'}</option>)}
              </select>) : null}
            {d ? (
              <select className="f" style={{ width: 'auto' }} value={tab} onChange={(e) => { setTab(e.target.value); setWeek(''); }}>
                {d.tabs.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>) : null}
            {d && d.weeks.length ? (
              <select className="f" style={{ width: 'auto' }} value={week} onChange={(e) => setWeek(e.target.value)}>
                {d.weeks.map((w) => <option key={w.week} value={w.week}>{pretty(w.week, w.week.slice(0, 4) !== String(source.year))} ({w.count})</option>)}
              </select>) : null}
          </span>
        </header>

        {err ? <div className="alertbar"><span><b>Could not read this sheet.</b> {err}</span></div> : null}
        {!d && !err ? <div className="pad note">Reading the sheet.</div> : null}
        {d && d.reason ? <div className="alertbar"><span><b>Could not make sense of the layout.</b> {d.reason} Pick a different tab above.</span></div> : null}

        {d && !d.reason ? (
          <>
            <div className="filters" style={{ padding: '10px 15px 0' }}>
              <button className={'fchip ' + (scope === 'week' ? 'on' : '')} onClick={() => setScope('week')}>This week ({d.summary.total})</button>
              <button className={'fchip ' + (scope === 'pending' ? 'on' : '')} onClick={() => setScope('pending')}>All pending ({d.items.filter((i) => i.pending || i.partial).length})</button>
              <button className={'fchip ' + (scope === 'all' ? 'on' : '')} onClick={() => setScope('all')}>Whole tab ({d.overall.total})</button>
            </div>
            <table>
              <thead><tr>
                <th style={{ width: 84 }}>Date</th><th>Output</th><th style={{ width: 120 }}>Type</th><th style={{ width: 120 }}>Owner</th>
                <th style={{ width: 130 }}>Stage</th><th>Exact gap</th><th style={{ width: 130 }}>Drive file</th><th style={{ width: 120 }} />
              </tr></thead>
              <tbody>
                {items.map((i, n) => (
                  <Fragment key={n}>
                    <tr onClick={() => setOpen(open === n ? null : n)} style={{ cursor: 'pointer', background: open === n ? 'var(--head)' : undefined }}>
                      <td className="dim">{i.date || i.dateRaw || 'Not set'}</td>
                      <td>{i.title || 'Untitled output'}
                        {i.remarks ? <div style={{ color: 'var(--warn)', fontSize: 12 }}>{i.remarks}</div> : null}</td>
                      <td><span className="tag mute">{i.type || i.channel || (i.channels || []).join(', ') || 'Not set'}</span></td>
                      <td className="dim">Not mapped</td>
                      <td className="dim">{i.status || 'Not set'}</td>
                      <td>{i.pending || i.partial ? <span className="tag bad">{exactGap(i) || 'Pending'}</span> : <span className="tag ok">Cleared</span>}</td>
                      <td>{i.creativeLink ? <a href={i.creativeLink} target="_blank" rel="noreferrer" onClick={stop}>Open file</a>
                        : i.creativeText || <span className="tag warn">missing</span>}</td>
                      <td>{lastRow === i.sheetRow ? <span className="tag ok">re-read</span>
                        : <button className="btn sm ai" onClick={(e) => { stop(e); recheck(i.sheetRow); }}>Recheck row</button>}</td>
                    </tr>
                    {open === n ? (
                      <tr>
                        <td colSpan={8} style={{ background: '#FCFDFE', borderBottom: '2px solid var(--line)' }}>
                          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                            {(i.captions || []).map((c, k) => (
                              <div key={k}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                  <span className="lbl">{c.channel}</span>
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
                {items.length === 0 ? <tr><td colSpan={8} className="dim">Nothing in this view.</td></tr> : null}
              </tbody>
            </table>
            <div style={{ padding: '12px 15px', borderTop: '1px solid var(--line2)', background: 'var(--okbg)', fontSize: 12.5, color: 'var(--ok)' }}>
              <b>{Math.max(0, d.summary.total - openGaps)} rows passed silently.</b> Click any row to read the full captions for every channel.
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

      {d && d.week ? <div className="callout"><span><b>Generated copy never writes itself into the sheet.</b> A person pushes it, empty cells are the safe default, and an explicit replacement is logged.</span>
        <Link className="btn" href={'/projects/' + project.slug + '/review?week=' + d.week}>Review and push</Link></div> : null}
    </>
  );
}
