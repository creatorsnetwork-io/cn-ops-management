'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import DraftPanel from './DraftPanel';
import { can } from '../lib/perm';

function shift(w, n) { const d = new Date(w + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n * 7); return d.toISOString().slice(0, 10); }
function pretty(w) {
  if (!w) return '';
  const a = new Date(w + 'T00:00:00Z'), b = new Date(w + 'T00:00:00Z');
  b.setUTCDate(b.getUTCDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return f(a) + ' to ' + f(b);
}
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const isUrl = (t) => /^https?:\/\/\S+$/.test(String(t || '').trim());

// Drive share links can be shown in the page. Same trick the client view uses.
function previewUrl(link) {
  const m = /\/file\/d\/([^/]+)/.exec(link || '');
  return m ? 'https://drive.google.com/file/d/' + m[1] + '/preview' : null;
}

function Preview({ link, text }) {
  const [show, setShow] = useState(false);
  const emb = previewUrl(link);
  if (!link) return <span className="tag warn">no creative link</span>;
  if (!emb) return <a href={link} target="_blank" rel="noreferrer" onClick={stop}>{text || 'Open the file'}</a>;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={(e) => { stop(e); setShow(!show); }}>
          {show ? 'Hide it' : 'Watch it here'}
        </button>
        <a className="btn sm" href={link} target="_blank" rel="noreferrer" onClick={stop}>Open in Drive</a>
      </div>
      {show ? <iframe className="cprev" style={{ marginTop: 9 }} src={emb} allow="autoplay" title="creative" /> : null}
    </div>);
}

// A quiet spinner any busy button on this page can drop in next to its own label.
function Spin() { return <span className="spin" aria-label="working" />; }

function Flag({ f, item, slug, week, canWaive, onDone }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(scope) {
    setBusy(true);
    await fetch('/api/review', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, week, action: 'waive', key: f.key, code: f.code,
        channel: f.channel || '', scope, postType: item.type || '' }),
    });
    setBusy(false); setAsk(false); onDone();
  }
  async function undo() {
    setBusy(true);
    await fetch('/api/review', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, week, action: 'unwaive', key: f.key, code: f.code,
        channel: f.channel || '', alsoRule: f.waivedScope === 'rule', postType: item.type || '' }),
    });
    setBusy(false); onDone();
  }

  if (f.waived) return (
    <div style={{ marginBottom: 3 }}>
      <span className="tag mute">not required</span>{' '}
      <span style={{ fontSize: 12.5, color: 'var(--faint)', textDecoration: 'line-through' }}>{f.message}</span>{' '}
      <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
        {f.waivedScope === 'rule' ? 'standing rule' : 'by ' + f.waivedBy}
      </span>
      {canWaive ? <button className="btn link" style={{ fontSize: 11.5 }} disabled={busy} onClick={undo}>{busy ? <><Spin /> Undoing</> : 'require it again'}</button> : null}
    </div>);

  return (
    <div style={{ marginBottom: 3 }}>
      <span className={'tag ' + (f.severity === 'block' ? 'bad' : 'warn')}>{f.severity === 'block' ? 'blocking' : 'check'}</span>{' '}
      <span style={{ fontSize: 12.5 }}>{f.message}</span>{' '}
      {canWaive && !ask ? <button className="btn link" style={{ fontSize: 11.5 }} onClick={() => setAsk(true)}>not required</button> : null}
      {ask ? (
        <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn sm" disabled={busy} onClick={() => send('once')}>{busy ? <><Spin /> Saving</> : 'Just this one'}</button>
          {item.type ? <button className="btn sm dark" disabled={busy} onClick={() => send('always')}>
            {busy ? <><Spin /> Saving</> : <>Always for {item.type}</>}
          </button> : null}
          <button className="btn sm" onClick={() => setAsk(false)}>Cancel</button>
        </div>) : null}
    </div>);
}
const stop = (e) => e.stopPropagation();

function Copy({ text }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return <button className="btn sm" onClick={(e) => { stop(e); navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}>{done ? 'Copied' : 'Copy'}</button>;
}

export default function WeekReview({ slug, startWeek }) {
  const [week, setWeek] = useState(startWeek);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setD(null); setErr(null); setMsg(''); setOpen(null);
    fetch('/api/review?slug=' + slug + '&week=' + week)
      .then((r) => r.json())
      .then((j) => (j.ok ? setD(j) : setErr(j.error)))
      .catch((e) => setErr(String(e)));
  }, [slug, week]);

  useEffect(load, [load]);

  async function act(action, extra) {
    setBusy(action); setMsg('');
    const r = await fetch('/api/review', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, week, action, ...(extra || {}) }),
    });
    const j = await r.json();
    setBusy('');
    if (j.ok) { setD(j); setMsg(''); } else setMsg(j.error || 'That did not work.');
  }

  const P = (d && d.perms) || {};
  const items = (d && d.items) || [];
  const shipped = !!(d && d.shipGate);
  const crafted = !!(d && d.craftGate);
  const notApproved = items.filter((i) => (i.review || {}).craft !== 'approved');
  const canWaive = P.canCraft || P.canShip || can(P.who || '', 'triageFeedback') === 'yes';
  const canOverride = ['yes', 'exception', 'oversight'].includes(can(P.who || '', 'shipOverride'));

  return (
    <>
      <div className="panel">
        <header>
          <h2>Week of {pretty(week)}</h2>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => setWeek(shift(week, -1))}>Previous</button>
            <button className="btn sm" onClick={() => setWeek(startWeek)}>This week</button>
            <button className="btn sm" onClick={() => setWeek(shift(week, 1))}>Next</button>
          </span>
        </header>

        {!d && !err ? <div className="empty">Reading the calendar.</div> : null}
        {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not open this week</b><span className="err">{err}</span></div></div> : null}

        {d ? (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
              <div className="stat">
                <div><b>{items.length}</b><span>posts</span></div>
                <div><b>{items.filter((i) => !i.pending).length}</b><span>content ready</span></div>
                <div><b style={{ color: d.blocking ? 'var(--bad)' : 'var(--ok)' }}>{d.blocking}</b><span>blocking</span></div>
                <div><b>{Math.max(0, d.flagCount - d.blocking)}</b><span>worth a look</span></div>
                <div><b>{items.length - notApproved.length}</b><span>creative signed</span></div>
                <div><b style={{ color: 'var(--ok)' }}>{d.clientApproved || 0}</b><span>client approved</span></div>
                {d.clientChanges ? <div><b style={{ color: 'var(--bad)' }}>{d.clientChanges}</b><span>changes asked</span></div> : null}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                {d.sheetTitle}, tab {d.tab}. {d.qcAt ? 'Checks last run ' + when(d.qcAt) + ' by ' + d.qcBy + '.' : 'Checks have not been run for this week.'}
                {d.toneAt ? ' Read for tone ' + when(d.toneAt) + ' by ' + d.toneBy + ', ' + (d.toneCount || 0) + ' note' + (d.toneCount === 1 ? '' : 's') + '. Tone notes never block a gate.' : ''}
                {d.imageAt ? ' Images checked ' + when(d.imageAt) + ' by ' + d.imageBy + ', ' + (d.imageCount || 0) + ' note' + (d.imageCount === 1 ? '' : 's') + '. Image notes never block a gate.' : ''}
              </p>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line2)', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn sm dark" disabled={!!busy} onClick={() => act('qc')}>{busy === 'qc' ? <><Spin /> Checking</> : 'Run quality checks'}</button>
              {can(P.who || '', 'generate') !== 'no' ? (
                <button className="btn sm" disabled={!!busy} onClick={async () => {
                  setBusy('tone'); setMsg('');
                  const r = await fetch('/api/generate', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'tone', slug, week }),
                  });
                  const j = await r.json(); setBusy('');
                  if (j.ok) { setMsg(j.count ? '' : 'Read the week, nothing worth raising.'); load(); } else setMsg(j.error);
                }}>{busy === 'tone' ? <><Spin /> Reading</> : '✦ Read it for tone'}</button>) : null}
              {can(P.who || '', 'generate') !== 'no' ? (
                <button className="btn sm" disabled={!!busy} onClick={async () => {
                  setBusy('image'); setMsg('');
                  const r = await fetch('/api/generate', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'image', slug, week }),
                  });
                  const j = await r.json(); setBusy('');
                  if (j.ok) { setMsg(j.count ? '' : 'Checked ' + j.total + ' item(s), nothing to flag.'); load(); } else setMsg(j.error);
                }}>{busy === 'image' ? <><Spin /> Checking images</> : '✦ Check images against captions'}</button>) : null}
              {can(P.who || '', 'generate') !== 'no' && !shipped ? (
                <button className="btn sm" disabled={!!busy} onClick={async () => {
                  setBusy('ideas'); setMsg('');
                  const r = await fetch('/api/generate', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'week', slug, week }),
                  });
                  const j = await r.json(); setBusy('');
                  setMsg(j.ok ? 'Drafted ' + j.drafts.length + ' idea(s). Open a row to see and write them.' : j.error);
                }}>{busy === 'ideas' ? <><Spin /> Thinking</> : '✦ Draft ideas for empty rows'}</button>) : null}
              {P.canCraft && !shipped ? (
                <button className="btn sm" disabled={!!busy || !notApproved.length}
                  onClick={() => act('craft', { keys: notApproved.map((i) => i.key), decision: 'approved' })}>
                  {busy === 'craft' ? <><Spin /> Approving</> : notApproved.length ? 'Approve all creative (' + notApproved.length + ')' : 'All creative approved'}
                </button>) : null}
              {P.canCraft && !crafted && !notApproved.length ? (
                <button className="btn sm dark" disabled={!!busy} onClick={() => act('craftGate')}>{busy === 'craftGate' ? <><Spin /> Signing</> : 'Sign the craft gate'}</button>) : null}
              {P.canShip && crafted && !shipped && !d.blocking ? (
                <button className="btn sm dark" disabled={!!busy} onClick={() => act('ship')}>{busy === 'ship' ? <><Spin /> Signing</> : 'Sign the ship gate'}</button>) : null}
              {canOverride && crafted && !shipped && d.blocking ? (
                <button className="btn sm req" disabled={!!busy} onClick={() => {
                  const note = window.prompt('Sending with ' + d.blocking + ' flag(s) still open. Why?');
                  if (note && note.trim()) act('ship', { override: true, note });
                }}>{busy === 'ship' ? <><Spin /> Sending</> : <>Send anyway, {d.blocking} open</>}</button>) : null}
              {P.share === 'yes' && shipped && !d.clientToken ? (
                <button className="btn sm dark" disabled={!!busy} onClick={() => act('share')}>{busy === 'share' ? <><Spin /> Creating</> : 'Create the client link'}</button>) : null}
              {d.clientToken ? (
                <>
                  <input className="inp mono" style={{ width: 330 }} readOnly value={typeof window !== 'undefined' ? window.location.origin + '/c/' + d.clientToken : ''} onFocus={(e) => e.target.select()} />
                  <button className="btn sm" onClick={() => navigator.clipboard.writeText(window.location.origin + '/c/' + d.clientToken)}>Copy link</button>
                  <a className="btn sm" target="_blank" rel="noreferrer" href={'/c/' + d.clientToken}>Open as the client sees it</a>
                </>) : null}
              {P.canShip && shipped ? (
                <button className="btn sm" disabled={!!busy} onClick={() => act('unship')}>{busy === 'unship' ? <><Spin /> Reopening</> : 'Reopen the week'}</button>) : null}
              {busy ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--faint)', fontSize: 12 }}><Spin /> working</span> : null}
              {msg ? <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>{msg}</span> : null}
            </div>

            {d.drift && d.drift.length ? (
              <div className="row"><span className="dot no" /><div className="t"><b>{d.drift.length} approved item(s) changed in the sheet since sign off</b>
                <span className="err">Rows {d.drift.join(', ')}. Re-approve them or the gate is signing something that no longer exists.</span></div></div>) : null}

            <table className="tbl">
              <thead><tr>
                <th style={{ width: 82 }}>Date</th><th style={{ width: 112 }}>Channel</th><th>Idea</th>
                <th style={{ width: 150 }}>Caption</th><th style={{ width: 150 }}>Creative</th>
                <th>Flags</th><th style={{ width: 148 }}>Creative sign off</th><th style={{ width: 150 }}>Client</th>
              </tr></thead>
              <tbody>
                {items.map((i, n) => {
                  const fl = d.flags[i.key] || [];
                  const rv = i.review || {};
                  return (
                    <Fragment key={i.key}>
                      <tr onClick={() => setOpen(open === n ? null : n)} style={{ cursor: 'pointer', background: open === n ? 'var(--head)' : undefined }}>
                        <td className="mono">{i.date || i.dateRaw || '—'}</td>
                        <td>{i.channel || (i.channels || []).join(', ') || i.type || '—'}
                          {i.type && (i.channel || (i.channels || []).length) ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>{i.type}</div> : null}</td>
                        <td>{i.title || '—'}</td>
                        <td>{(i.captions || []).length > 1
                          ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(i.captions || []).map((c, k) => <span key={k} className={'tag ' + (c.has ? 'ok' : 'warn')}>{c.channel}</span>)}
                            </div>
                          : i.hasCaption ? <span className="tag ok">written</span> : <span className="tag warn">nothing</span>}</td>
                        <td>{i.creativeLink
                          ? <a href={i.creativeLink} target="_blank" rel="noreferrer" onClick={stop}>{(i.creativeText || 'open file').slice(0, 26)}</a>
                          : i.creativeText ? i.creativeText.slice(0, 26) : <span className="tag warn">missing</span>}</td>
                        <td>{fl.length === 0
                          ? (d.qcAt ? <span className="tag ok">clear</span> : <span className="tag mute">not checked</span>)
                          : fl.slice(0, 4).map((f, k) => (
                              <Flag key={k} f={f} item={i} slug={slug} week={week} canWaive={canWaive} onDone={load} />))}
                          {fl.length > 4 ? <div style={{ color: 'var(--faint)', fontSize: 12 }}>and {fl.length - 4} more, open the row</div> : null}
                          {((d.tone || {})[i.key] || []).map((t, k) => (
                            <div key={'t' + k} style={{ marginTop: 3 }}>
                              <span className="tag info">tone</span>{' '}
                              <span style={{ fontSize: 12.5 }}>{t.note}</span>
                            </div>))}
                          {((d.image || {})[i.key] || []).map((t, k) => (
                            <div key={'im' + k} style={{ marginTop: 3 }}>
                              <span className="tag warn">image{t.channel ? ', ' + t.channel : ''}</span>{' '}
                              <span style={{ fontSize: 12.5 }}>{t.note}</span>
                            </div>))}</td>
                        <td>
                          {rv.craft === 'approved' ? <span className="tag ok">signed by {rv.craftBy}</span>
                            : rv.craft === 'changes' ? <span className="tag bad">changes asked</span>
                            : <span className="tag mute">waiting</span>}
                          {P.canCraft && !shipped ? (
                            <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                              {rv.craft !== 'approved' ? <button className="btn sm" disabled={!!busy} onClick={(e) => { stop(e); act('craft', { keys: [i.key], decision: 'approved' }); }}>Approve</button> : null}
                              {rv.craft !== 'changes' ? <button className="btn sm" disabled={!!busy} onClick={(e) => { stop(e); act('craft', { keys: [i.key], decision: 'changes' }); }}>Changes</button> : null}
                            </div>) : null}
                        </td>
                        <td>
                          {i.client
                            ? <>
                                <span className={'tag ' + (i.client.decision === 'approved' ? 'ok' : 'bad')}>
                                  {i.client.decision === 'approved' ? 'approved' : 'changes'}
                                </span>
                                <div style={{ color: 'var(--faint)', fontSize: 12, marginTop: 3 }}>{i.client.by}</div>
                              </>
                            : shipped ? <span className="tag mute">waiting</span> : <span className="tag mute">not sent</span>}
                        </td>
                      </tr>
                      {open === n ? (
                        <tr><td colSpan={8} style={{ background: '#FCFDFE', borderBottom: '2px solid var(--line)' }}>
                          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                            {(i.captions || []).map((c, k) => (
                              <div key={k}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                  <span style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700 }}>{c.channel}</span>
                                  {c.has && !isUrl(c.text) ? <Copy text={c.text} /> : null}
                                </div>
                                {!c.has ? <span className="tag warn">nothing written</span>
                                  : isUrl(c.text) ? <a href={c.text.trim()} target="_blank" rel="noreferrer" onClick={stop}>Open the document</a>
                                  : <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}>{c.text}</div>}
                              </div>))}
                          </div>
                          {fl.length ? (
                            <div style={{ marginTop: 13 }}>
                              {fl.map((f, k) => (
                                <Flag key={k} f={f} item={i} slug={slug} week={week} canWaive={canWaive} onDone={load} />))}
                            </div>) : null}

                          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                            <div className="lbl" style={{ marginBottom: 6 }}>The creative</div>
                            <Preview link={i.creativeLink} text={i.creativeText} />
                          </div>
                          <DraftPanel slug={slug} week={week} item={i} who={P.who || ''} onWritten={load}
                            qcAt={d.qcAt} flags={fl} imageFlags={(d.image || {})[i.key] || []} />

                          <div style={{ marginTop: 13, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
                            <span>Sheet row <b>{i.sheetRow}</b></span>
                            {i.creativeLink ? <a href={i.creativeLink} target="_blank" rel="noreferrer" onClick={stop}>Open the creative</a> : null}
                            {rv.craftNote ? <span>Note: {rv.craftNote}</span> : null}
                            {i.client && i.client.comment ? <span style={{ color: 'var(--bad)' }}>Client: {i.client.comment}</span> : null}
                          </div>
                        </td></tr>) : null}
                    </Fragment>);
                })}
                {items.length === 0 ? <tr><td colSpan={8} className="empty">No posts dated in this week.</td></tr> : null}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
              Click any row to read the full captions and every flag on it.
            </div>
          </>
        ) : null}
      </div>

      {d ? (
        <div className="panel">
          <header><h2>Gates</h2></header>
          <div className="row">
            <span className={'dot ' + (crafted ? 'ok' : 'no')} />
            <div className="t"><b>Craft gate, Shelly</b>
              <span>{crafted ? 'Signed by ' + d.craftGate.by + ' on ' + when(d.craftGate.at)
                : notApproved.length + ' of ' + items.length + ' items still waiting on creative sign off'}</span></div>
            <span className={'tag ' + (crafted ? 'ok' : 'mute')}>{crafted ? 'signed' : 'open'}</span>
          </div>
          <div className="row">
            <span className={'dot ' + (shipped ? 'ok' : 'no')} />
            <div className="t"><b>Ship gate, Aashif</b>
              <span>{shipped
                ? 'Signed by ' + d.shipGate.by + ' on ' + when(d.shipGate.at) + (d.shipGate.override ? '. Overridden with blocking flags open.' : '')
                : !d.qcAt ? 'Quality checks have not been run yet'
                : !crafted ? 'Waiting for the craft gate'
                : d.blocking ? d.blocking + ' blocking flag(s) still open'
                : 'Ready to sign'}</span></div>
            <span className={'tag ' + (shipped ? 'ok' : 'mute')}>{shipped ? 'signed' : 'open'}</span>
          </div>
          <div className="row">
            <span className={'dot ' + (d.clientApproved === items.length && items.length ? 'ok' : 'no')} />
            <div className="t"><b>Client</b>
              <span>{!d.clientToken ? 'No link created yet'
                : d.clientApproved + ' approved, ' + (d.clientChanges || 0) + ' changes asked, ' + Math.max(0, items.length - d.clientApproved - (d.clientChanges || 0)) + ' not answered'}</span></div>
            <span className={'tag ' + (items.length && d.clientApproved === items.length ? 'ok' : 'mute')}>
              {items.length && d.clientApproved === items.length ? 'all approved' : 'open'}</span>
          </div>
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            Your permission on these: creative {P.craft || 'no'}, ship {P.ship || 'no'}.
            An override on the ship gate writes an escalation automatically.
          </div>
        </div>
      ) : null}
    </>
  );
}
