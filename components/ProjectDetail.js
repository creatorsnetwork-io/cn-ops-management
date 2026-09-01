'use client';
import { useState } from 'react';
import Link from 'next/link';
import CalendarSources from './CalendarSources';
import Contract from './Contract';
import Deliverables from './Deliverables';
import Milestones from './Milestones';
import MonthCycle from './MonthCycle';
import ProjectIdeas from './ProjectIdeas';
import ProjectTabs from './ProjectTabs';
import { KINDS, LABEL, TAG, verbsFor, canAssign, isLate } from '../lib/work';

function Spin() { return <span className="spin" aria-label="working" />; }

// The brand brain lives on the client now, shared by every project under it.
function hasBrand(b) {
  if (!b) return false;
  return !!(String(b.positioning || '').trim() || String(b.visual || '').trim()
    || (b.voiceIs || []).length || (b.voiceIsNot || []).length
    || (b.neverSay || []).length || (b.always || []).length);
}

const TYPE = { social: 'Social retainer', website: 'Website', seo: 'SEO', influencer: 'Influencer', video: 'Video', aiVideo: 'AI video', events: 'Event' };
const STAGES = {
  social: ['Plan', 'Ideas', 'Copy', 'Creative', 'QC', 'Client', 'Approved', 'Posted'],
  website: ['PRD', 'Wireframe', 'Design', 'Build', 'Content', 'QA', 'Launch'],
  seo: ['Plan', 'Execute', 'Fixes', 'Report'],
  influencer: ['Brief', 'Shortlist', 'Client approves', 'Briefs sent', 'Content in', 'QC', 'Client', 'Posted', 'Report'],
  video: ['Brief', 'Script', 'Pre-production', 'Shoot', 'Edit', 'QC', 'Client', 'Masters'],
  aiVideo: ['Brief', 'Script', 'References', 'Generate', 'Assembly', 'QC', 'Client', 'Masters'],
  events: ['Brief', 'Plan', 'Production', 'Delivery', 'Client', 'Report'],
};
const pct = (a, b) => (!b ? 0 : Math.min(100, Math.round((a / b) * 100)));
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Time not recorded');
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

function WorkRow({ item, who, roster, workBusy, workNote, assignWork, moveWork, perms }) {
  const allowed = verbsFor(item, who, perms).filter((verb) => verb.ok);
  const direct = allowed.filter((v) => !v.needNote && !v.needWho && (!v.needLink || item.driveLink));
  const detail = allowed.filter((v) => !direct.some((d) => d.name === v.name));
  const change = canAssign(item, who, perms);
  const people = change.list === null
    ? roster
    : roster.filter((person) => (change.list || []).includes(person.slug));
  const shortKind = ({ page: 'WEB', article: 'COPY', report: 'RPT', asset: 'ART', film: 'FILM', aivideo: 'AI', campaign: 'CMP', other: 'WORK' })[item.kind] || 'WORK';

  return (
    <div className="wi">
      <div className="ty">{shortKind}</div>
      <div className="tx">
        <b><Link href={'/work/' + item._id}>{item.title}</Link></b>
        <span>
          {KINDS[item.kind]?.label || item.kind}
          {item.driveLink ? ' · output linked' : ''}
          {item.deliverable ? ' · counts toward ' + item.deliverable : ''}
          {item.firstTime ? ' · first time' : ''}
        </span>
      </div>
      <div className="mt">
        <div className="lbl">Owner</div>
        <div className="v">
          {change.ok ? (
            <select className="f" value={item.assignee || ''} disabled={workBusy === item._id}
              onChange={(e) => assignWork(item._id, e.target.value)}>
              <option value="">Nobody</option>
              {people.map((person) => <option key={person.slug} value={person.slug}>{person.name}</option>)}
            </select>
          ) : item.assigneeName || <span className="tag warn">nobody</span>}
        </div>
      </div>
      <div className="mt"><div className="lbl">Due</div><div className="v">{dayOf(item.due) || 'Not set'}</div>{isLate(item) ? <span className="tag bad">late</span> : null}</div>
      <div className="mt"><div className="lbl">State</div><div className="v"><span className={'tag ' + (TAG[item.state] || 'mute')}>{LABEL[item.state] || item.state}</span></div></div>
      <div className="ac">
        {direct.map((verb) => (
          <button key={verb.name} className={'btn sm ' + (verb.name === 'start' ? '' : 'dark')}
            disabled={workBusy === item._id} onClick={() => moveWork(item._id, verb.name, { link: item.driveLink })}>{verb.label}</button>
        ))}
        {detail.map((verb) => <Link key={verb.name} className="btn sm" href={'/work/' + item._id}>{verb.label}</Link>)}
        <Link className="btn sm" href={'/work/' + item._id}>Open item</Link>
      </div>
      {workNote[item._id] ? <div className="note" style={{ width: '100%', paddingLeft: 52, color: 'var(--bad)' }}>{workNote[item._id]}</div> : null}
    </div>
  );
}

export default function ProjectDetail({ p, activity, perms, activeTab, who }) {
  const tab = activeTab;
  const [work, setWork] = useState(p.work || []);
  const [workNote, setWorkNote] = useState({});
  const [workBusy, setWorkBusy] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [finalFilesUrl, setFinalFilesUrl] = useState(p.finalFilesUrl || '');
  const [shortfallNote, setShortfallNote] = useState('');
  const [packGeneratedAt, setPackGeneratedAt] = useState(p.packGeneratedAt || '');
  const [packBusy, setPackBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeErr, setCloseErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const stages = STAGES[p.type] || ['Plan', 'Production', 'Client', 'Approved'];
  const stageIndex = p.stage === 'Closed' ? stages.length : Math.max(0, stages.indexOf(p.stage));
  const latestReview = (p.reviews || [])[0];
  const contractUrl = '/projects/' + p.slug + '?tab=deliverables#contract';
  const shortfall = p.target > 0 && p.approved < p.target;

  async function moveWork(id, verb, extra) {
    setWorkBusy(id); setWorkNote((prev) => ({ ...prev, [id]: '' }));
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'move', id, verb, ...(extra || {}) }),
    });
    const j = await r.json(); setWorkBusy('');
    if (j.ok) setWork((prev) => prev.map((item) => (item._id === id ? j.item : item)));
    else setWorkNote((prev) => ({ ...prev, [id]: j.error }));
  }

  async function assignWork(id, slug) {
    setWorkBusy(id); setWorkNote((prev) => ({ ...prev, [id]: '' }));
    const r = await fetch('/api/work', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'assign', id, assignee: slug }),
    });
    const j = await r.json(); setWorkBusy('');
    if (j.ok) setWork((prev) => prev.map((item) => (item._id === id ? j.item : item)));
    else setWorkNote((prev) => ({ ...prev, [id]: j.error }));
  }

  async function generatePack() {
    setPackBusy(true);
    window.open('/projects/' + p.slug + '/pack', '_blank');
    const r = await fetch('/api/project/' + p.slug, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markPackGenerated: true }),
    });
    const j = await r.json(); setPackBusy(false);
    if (j.ok) setPackGeneratedAt(j.packGeneratedAt);
  }

  async function closeProject() {
    const errs = {};
    if (!closeReason.trim()) errs.reason = 'Write why this is closing now.';
    if (!finalFilesUrl.trim()) errs.finalFilesUrl = 'Add a link before closing.';
    if (shortfall && !shortfallNote.trim()) errs.shortfallNote = 'Explain the shortfall before closing.';
    if (!packGeneratedAt) errs.pack = 'Generate the dispute pack before closing.';
    if (Object.keys(errs).length) { setFieldErr(errs); return; }
    setFieldErr({});
    setCloseBusy(true); setCloseErr('');
    const r = await fetch('/api/project/' + p.slug, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ close: { reason: closeReason, finalFilesUrl, shortfallNote } }),
    });
    const j = await r.json(); setCloseBusy(false);
    if (j.ok) window.location.href = '/archive';
    else setCloseErr(j.error);
  }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{p.client?.name} · {TYPE[p.type] || p.type}</div>
          <h1>{p.name}</h1>
          <p className="lede">{p.subtitle}. {p.timeline}.</p>
        </div>
        <div className="rowb">
          {p.type === 'social' ? <Link className="btn ai" href={'/projects/' + p.slug + '/review'}>✦ Plan week</Link> : null}
          {p.type === 'social' && perms.canShare
            ? <Link className="btn" href={'/projects/' + p.slug + '/review' + (latestReview?.week ? '?week=' + latestReview.week : '')}>Share client link</Link> : null}
          <Link className="btn" href={contractUrl}>Contract</Link>
          {perms.canClose && !closing ? <button className="btn off" onClick={() => setClosing(true)}>Close project</button> : null}
        </div>
      </div>

      {closing ? (
        <div className="panel">
          <header><h2>Close this project</h2></header>
          <div className="pad">
            <p className="note">Deliverables reconciled, final files linked and a dispute pack generated are what closing means, not just a reason on file. All three below are required.</p>

            <div style={{ marginBottom: 10 }}>
              <div className="k">1. Deliverables</div>
              {shortfall ? (
                <>
                  <p className="s" style={{ margin: '2px 0 6px' }}>Short: {p.approved} of {p.target} approved. Explain the shortfall before closing.</p>
                  <textarea style={fieldErr.shortfallNote ? { borderColor: 'var(--bad)' } : undefined} value={shortfallNote} onChange={(e) => { setShortfallNote(e.target.value); setFieldErr((f) => ({ ...f, shortfallNote: '' })); }} placeholder="Why is this closing short of the committed number" />
                  {fieldErr.shortfallNote ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 3 }}>{fieldErr.shortfallNote}</div> : null}
                </>
              ) : (
                <p className="s" style={{ margin: '2px 0' }}>{p.target ? 'Reconciled: ' + p.approved + ' of ' + p.target + ' approved.' : 'No deliverable targets set on this project.'}</p>
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div className="k">2. Final files</div>
              <input className="inp" style={fieldErr.finalFilesUrl ? { borderColor: 'var(--bad)' } : undefined} value={finalFilesUrl} onChange={(e) => { setFinalFilesUrl(e.target.value); setFieldErr((f) => ({ ...f, finalFilesUrl: '' })); }} placeholder="Link to masters, exports and the last approved versions" />
              {fieldErr.finalFilesUrl ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 3 }}>{fieldErr.finalFilesUrl}</div> : null}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div className="k">3. Dispute pack</div>
              {packGeneratedAt ? (
                <p className="s" style={{ margin: '2px 0' }}>Generated. <Link href={'/projects/' + p.slug + '/pack'}>Open it again</Link></p>
              ) : (
                <button className="btn sm" type="button" disabled={packBusy} onClick={generatePack}>{packBusy ? <><Spin /> Opening</> : 'Generate dispute pack'}</button>
              )}
              {fieldErr.pack ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 3 }}>{fieldErr.pack}</div> : null}
            </div>

            <div className="k">Reason</div>
            <textarea style={fieldErr.reason ? { borderColor: 'var(--bad)' } : undefined} value={closeReason} onChange={(e) => { setCloseReason(e.target.value); setFieldErr((f) => ({ ...f, reason: '' })); }} placeholder="Why is this closing now" />
            {fieldErr.reason ? <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 3 }}>{fieldErr.reason}</div> : null}
            {closeErr ? <div className="alertbar">{closeErr}</div> : null}
            <div className="rowb" style={{ marginTop: 10 }}>
              <button className="btn dark" disabled={closeBusy} onClick={closeProject}>{closeBusy ? <><Spin /> Closing</> : 'Confirm close'}</button>
              <button className="btn" onClick={() => { setClosing(false); setCloseReason(''); setCloseErr(''); setFieldErr({}); }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="stats">
        <div><div className="lbl">Current stage</div><div className="v">{p.stage}</div><div className="s">Owner {p.owner?.name || 'not assigned'}</div></div>
        <div><div className="lbl">Timeline</div><div className="v">{p.cadenceLabel} · {p.term}</div><div className="s">{p.timeline}</div></div>
        <div><div className="lbl">Approved by client</div><div className="v">{p.approved} of {p.target || '?'}</div><div className="bar2" style={{ marginTop: 6 }}><i style={{ width: pct(p.approved, p.target) + '%' }} /></div></div>
        <div><div className="lbl">Client access</div><div className="v">{p.hasClientAccess ? 'Review link live' : 'Not invited'}</div><div className="s">No internal notes exposed</div></div>
      </div>

      <ProjectTabs slug={p.slug} type={p.type} on="" activeTab={tab} workCount={p.workCount} />

      {tab === 'overview' ? <>
        <div className="panel">
          <header><div><h2>Project workflow</h2><div className="sub2">Shared engine, service-specific stages.</div></div><span className="badge ok">Template applied</span></header>
          <div className="stepper">
            {stages.map((stage, i) => <div key={stage} className={'st ' + (i < stageIndex ? 'done' : i === stageIndex ? 'now' : '')}>
              <div className="cir">{i < stageIndex ? '✓' : i + 1}</div><div className="bar" /><div className="lb">{stage}</div>
            </div>)}
          </div>
        </div>

        <div className="grid2">
          <div className="srcs">
            <div className="src"><div className="ic">▤</div><div className="tx"><div className="lbl">Contract</div><div className="v">{p.contract?.filename || 'Not uploaded'}</div><div className="s">Deliverable baseline and source agreement</div></div><Link className="btn sm" href={contractUrl}>Open</Link></div>
            <div className="src"><div className="ic">◫</div><div className="tx"><div className="lbl">Project brief / PRD</div><div className="v">{p.prd ? 'Working document ready' : 'Not started'}</div><div className="s">Versioned requirements</div></div><Link className="btn sm" href={'/projects/' + p.slug + '/prd'}>Open</Link></div>
            <div className="src"><div className="ic">✦</div><div className="tx"><div className="lbl">Client brand brain</div><div className="v">{hasBrand(p.client?.brand) ? 'Filled in' : (p.voice ? 'Voice note only' : 'Context missing')}</div><div className="s">Lives on the client, shared by every one of their projects</div></div><Link className="btn sm" href={'/brand' + (p.client?.slug ? '?client=' + p.client.slug : '')}>Open</Link></div>
            <div className="src"><div className="ic">↗</div><div className="tx"><div className="lbl">Client Drive</div><div className="v">{p.client?.driveFolderId ? p.client.code + ' folder' : 'Not linked'}</div><div className="s">Working files stay in Google Drive</div></div>{p.client?.driveFolderId ? <a className="btn sm" href={'https://drive.google.com/drive/folders/' + p.client.driveFolderId} target="_blank" rel="noreferrer">Open</a> : null}</div>
            <div className="src"><div className="ic">⌁</div><div className="tx"><div className="lbl">Record of approvals</div><div className="v">Append-only evidence pack</div><div className="s">What the client saw, said and approved</div></div><Link className="btn sm" href={'/projects/' + p.slug + '/pack'}>Open</Link></div>
          </div>

          <div className="panel">
            <header><h2>Attached signals</h2></header>
            <table><tbody>
              <tr><td className="b"><Link href="/qc">QC flags</Link></td><td className="num">{p.signals.qc}</td><td className="dim">→</td></tr>
              <tr><td className="b"><Link href="/feedback">Client feedback</Link></td><td className="num">{p.signals.feedback}</td><td className="dim">→</td></tr>
              <tr><td className="b"><Link href="/requests">Open requests</Link></td><td className="num">{p.signals.requests}</td><td className="dim">→</td></tr>
              <tr><td className="b"><Link href="/reports">Reports</Link></td><td className="num">{p.signals.reports}</td><td className="dim">→</td></tr>
              {p.type === 'social' ? <tr><td className="b"><Link href={'/projects/' + p.slug + '/calendar'}>Calendar sources</Link></td><td className="num">{(p.calendarSources || []).filter((x) => x.current).length}</td><td className="dim">→</td></tr> : null}
            </tbody></table>
          </div>
        </div>

        {p.cadence === 'monthly' ? <MonthCycle slug={p.slug} /> : null}
        {p.cadence === 'milestone' ? <Milestones slug={p.slug} initial={p.milestones || []} canAdd={perms.canAddMilestone} /> : null}
        {p.cadence === 'perAsset' ? <div className="guard">This project is tracked one asset at a time. Each asset is a work item, so there is no separate cycle to maintain.</div> : null}
        {p.type === 'social' ? <CalendarSources slug={p.slug} initial={p.calendarSources || []} canEdit={perms.canEditCalendar} /> : null}
      </> : null}

      {tab === 'ideas' ? <ProjectIdeas slug={p.slug} clientDrive={p.client?.driveFolderId}
        canMark={perms.canMarkIdeas} initialDoc={p.ideasDoc} initialLink={p.ideasLink} /> : null}

      {tab === 'deliverables' ? <>
        <div id="contract"><Contract slug={p.slug} contract={p.contract} canUpload={perms.canUploadContract} /></div>
        <Deliverables slug={p.slug} initial={p.deliverables || []} work={p.work || []} canEdit={perms.canEditDeliverables} />
      </> : null}

      {tab === 'work' ? <div className="panel">
        <header><div><h2>Work items</h2><div className="sub2">Every item keeps its current state and opens into the live verb and permission flow.</div></div>
          {perms.canCreateWork ? <Link className="btn sm" href="/work">Add work item</Link> : null}</header>
        {work.length ? work.map((item) => <WorkRow key={item._id} item={item} who={who} roster={p.people || []}
          workBusy={workBusy} workNote={workNote} assignWork={assignWork} moveWork={moveWork} perms={perms} />)
          : <div className="pad note">No work items on this project yet.</div>}
      </div> : null}

      {tab === 'activity' ? <div className="panel">
        <header><div><h2>Activity log</h2><div className="sub2">Append only. Nothing here can be edited or deleted.</div></div><Link className="btn dark" href={'/projects/' + p.slug + '/pack'}>Generate dispute pack</Link></header>
        <div className="tline">
          {(activity || []).map((a) => <div className={'ev ' + (String(a.who || '').startsWith('client:') || String(a.who || '').startsWith('external:') ? 'cl' : String(a.who || '') === 'system' ? 'sys' : '')} key={a._id}>
            <div className="tm">{when(a.at)}</div><div className="dt"><i /></div>
            <div className="cn"><b>{a.what}</b><span>{a.who || 'system'}{a.detail ? ' · ' + a.detail : ''}</span></div>
          </div>)}
          {(activity || []).length === 0 ? <div className="pad note">Nothing has been logged against this project yet.</div> : null}
        </div>
      </div> : null}
    </>
  );
}
