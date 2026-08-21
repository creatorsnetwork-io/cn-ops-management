'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

function FlagCard({ row, flag, canWaive, onRefresh }) {
  const [evidence, setEvidence] = useState(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function loadEvidence() {
    setBusy('evidence'); setErr('');
    const r = await fetch('/api/review?slug=' + encodeURIComponent(row.projectSlug) + '&week=' + row.week);
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    setEvidence((j.items || []).find((i) => i.key === flag.key) || { missing: true });
  }

  async function rerun() {
    setBusy('rerun'); setErr('');
    const r = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: row.projectSlug, week: row.week, action: 'qc' }) });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    onRefresh();
  }

  async function waive(scope) {
    setBusy('waive'); setErr('');
    const r = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: row.projectSlug, week: row.week, action: 'waive', key: flag.key,
        code: flag.code, channel: flag.channel || '', scope, postType: (evidence && evidence.type) || '' }) });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    onRefresh();
  }

  const captions = evidence && (evidence.captions || []).filter((c) => c.has);
  return (
    <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--line2)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="ty" style={{ background: flag.severity === 'block' ? 'var(--badbg)' : 'var(--warnbg)', color: flag.severity === 'block' ? 'var(--bad)' : 'var(--warn)', width: 40, height: 25, borderRadius: 6, fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{flag.severity === 'block' ? '!!' : '!'}</div>
        <div style={{ flex: 1, minWidth: 230 }}>
          <b style={{ fontSize: 13.5 }}>{flag.message}</b>
          <div className="sub2">{row.client} · {row.projectName} · week of {dayOf(row.week)} · {flag.label || flag.key}</div>
          <div className="ref">
            <div className="rl">Evidence</div>
            {evidence ? (
              evidence.missing ? <div className="rc">The current sheet no longer contains this row.</div> : <>
                <div className="rc">{captions && captions.length
                  ? captions.map((c) => c.channel + ': ' + c.text).join('\n\n')
                  : 'No caption is present on the current row.'}</div>
                <div className="rm">Sheet row {evidence.sheetRow}. {evidence.type || evidence.channel || 'Post type not set'}.
                  {evidence.creativeLink ? ' Creative file linked.' : ' No creative file linked.'}</div>
              </>
            ) : <div className="rc">Load the current row to compare this stored flag with the live sheet.</div>}
          </div>
          {err ? <div className="note" style={{ color: 'var(--bad)', marginTop: 7 }}>{err}</div> : null}
        </div>
        <div className="ac" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <span className={'tag ' + (flag.severity === 'block' ? 'bad' : 'warn')}>{flag.severity === 'block' ? 'blocking' : 'check'}</span>
          {!evidence ? <button className="btn sm" disabled={busy === 'evidence'} onClick={loadEvidence}>{busy === 'evidence' ? 'Reading' : 'Load evidence'}</button> : null}
          <Link className="btn sm" href={'/projects/' + row.projectSlug + '/review?week=' + row.week}>Open the row</Link>
          {flag.creativeLink ? <a className="btn sm" href={flag.creativeLink} target="_blank" rel="noreferrer">Open creative</a> : null}
          <button className="btn sm dark" disabled={busy === 'rerun'} onClick={rerun}>{busy === 'rerun' ? 'Checking' : 'Fixed, re-run week'}</button>
          {canWaive && !ask ? <button className="btn sm" onClick={() => setAsk(true)}>Not required</button> : null}
          {ask ? <>
            <button className="btn sm" disabled={busy === 'waive'} onClick={() => waive('once')}>Just this one</button>
            {evidence && evidence.type ? <button className="btn sm dark" disabled={busy === 'waive'} onClick={() => waive('always')}>Always for {evidence.type}</button> : null}
            <button className="btn sm" onClick={() => setAsk(false)}>Cancel</button>
          </> : null}
        </div>
      </div>
    </div>
  );
}

export default function QCDashboard({ initialWeeks, canWaive }) {
  const [project, setProject] = useState('all');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');

  const projects = useMemo(() => {
    const seen = {};
    for (const row of initialWeeks) if (!seen[row.projectSlug]) seen[row.projectSlug] = row;
    return Object.values(seen);
  }, [initialWeeks]);
  const weeks = project === 'all' ? initialWeeks : initialWeeks.filter((w) => w.projectSlug === project);
  const flags = weeks.flatMap((row) => (row.flags || []).map((flag) => ({ row, flag })));
  const open = flags.filter(({ flag }) => !flag.waived);
  const dismissed = flags.filter(({ flag }) => flag.waived);
  const cleared = weeks.filter((row) => row.qcAt && !(row.flags || []).length);
  const passed = weeks.reduce((sum, row) => {
    const flaggedRows = new Set((row.flags || []).filter((f) => !f.waived).map((f) => f.key)).size;
    return sum + Math.max(0, Number(row.shipped || 0) - flaggedRows);
  }, 0);

  async function rerunAll() {
    const targets = [];
    const seen = new Set();
    for (const row of weeks) if (!seen.has(row.projectSlug)) { seen.add(row.projectSlug); targets.push(row); }
    if (!targets.length) return;
    setBusy(true); setErr('');
    for (let n = 0; n < targets.length; n++) {
      const row = targets[n];
      setProgress('Checking ' + (n + 1) + ' of ' + targets.length + ': ' + row.projectName);
      const r = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: row.projectSlug, week: row.week, action: 'qc' }) });
      const j = await r.json();
      if (!j.ok) { setErr(row.projectName + ': ' + j.error); setBusy(false); return; }
    }
    window.location.reload();
  }

  return (
    <>
      <div className="head">
        <div><div className="eyebrow">AI checks, human decisions</div><h1>{open.length} open flag{open.length === 1 ? '' : 's'}</h1>
          <p className="lede">Every flag keeps its project, week and source row together. Fixes re-read the current sheet through the existing review flow.</p></div>
        <div className="rowb"><button className="btn ai" disabled={busy || !weeks.length} onClick={rerunAll}>✦ Re-run all</button>
          {progress ? <span className="note" style={{ margin: 0, alignSelf: 'center' }}>{progress}</span> : null}</div>
      </div>
      {err ? <div className="alertbar">{err}</div> : null}

      <div className="kpis">
        <div className="kpi"><span className="d r" /><div className="lbl">Open</div><div className="v">{open.length}</div><div className="n">blocking and advisory</div></div>
        <div className="kpi"><span className="d g" /><div className="lbl">Passed silently</div><div className="v">{passed}</div><div className="n">recorded shipped rows</div></div>
        <div className="kpi"><div className="lbl">Cleared after a fix</div><div className="v">{cleared.length}</div><div className="n">clear week snapshots</div></div>
        <div className="kpi"><div className="lbl">Dismissed as wrong</div><div className="v">{dismissed.length}</div><div className="n">visible as not required</div></div>
      </div>

      <div className="filters"><button className={'fchip ' + (project === 'all' ? 'on' : '')} onClick={() => setProject('all')}>All projects</button>
        {projects.map((p) => <button key={p.projectSlug} className={'fchip ' + (project === p.projectSlug ? 'on' : '')}
          onClick={() => setProject(p.projectSlug)}>{p.client} · {p.projectName}</button>)}</div>

      <div className="panel"><header><div><h2>Open flags</h2><div className="sub2">A flag only stops the gate while it is open and not waived.</div></div></header>
        {open.length ? open.sort((a, b) => (a.flag.severity === b.flag.severity ? 0 : a.flag.severity === 'block' ? -1 : 1))
          .map(({ row, flag }, n) => <FlagCard key={row.projectSlug + row.week + flag.key + flag.code + n}
            row={row} flag={flag} canWaive={canWaive} onRefresh={() => window.location.reload()} />)
          : <div className="pad note">No open flags in this view.</div>}
      </div>

      <div className="grid2">
        <div className="panel"><header><h2>Cleared after recheck</h2><span className="pill">{cleared.length}</span></header>
          {cleared.length ? <table><tbody>{cleared.map((row) => <tr key={row.projectSlug + row.week}>
            <td className="b">{row.projectName}</td><td className="dim">week of {dayOf(row.week)}</td><td><span className="tag ok">clear</span></td>
          </tr>)}</tbody></table> : <div className="pad note">No clear week snapshots yet.</div>}
        </div>
        <div className="panel"><header><h2>Dismissed as not required</h2><span className="pill">{dismissed.length}</span></header>
          {dismissed.length ? <table><tbody>{dismissed.map(({ row, flag }, n) => <tr key={row.projectSlug + row.week + flag.key + n}>
            <td className="b">{flag.message}</td><td className="dim">{row.projectName}</td><td><span className="tag mute">{flag.waivedScope === 'rule' ? 'standing rule' : 'just this one'}</span></td>
          </tr>)}</tbody></table> : <div className="pad note">No flags have been marked not required.</div>}
        </div>
      </div>
      {!initialWeeks.length ? <div className="panel"><div className="pad note">Nothing checked yet. Open a project's weekly review and run quality checks.</div></div> : null}
      <p className="note">Cleared flag history is not stored per flag by the current review API. The cleared register therefore shows saved week snapshots with zero flags, and not required flags remain visible in the dismissed register.</p>
    </>
  );
}
