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
import { KINDS, LABEL, TAG } from '../lib/work';

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

export default function ProjectDetail({ p, activity, perms }) {
  const [tab, setTab] = useState('overview');
  const stages = STAGES[p.type] || ['Plan', 'Production', 'Client', 'Approved'];
  const stageIndex = p.stage === 'Closed' ? stages.length : Math.max(0, stages.indexOf(p.stage));
  const latestReview = (p.reviews || [])[0];
  const tabs = [['overview', 'Overview']];
  if (p.type === 'social') tabs.push(['ideas', 'Ideas']);
  tabs.push(['deliverables', 'Deliverables']);
  tabs.push(['work', 'Work items (' + (p.work || []).length + ')']);
  tabs.push(['activity', 'Activity log']);

  function openContract() {
    setTab('deliverables');
    setTimeout(() => document.getElementById('contract')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
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
          <button className="btn" onClick={openContract}>Contract</button>
          {perms.canClose ? <button className="btn off" disabled title="The live API does not expose project closure yet.">Close project</button> : null}
        </div>
      </div>

      <div className="stats">
        <div><div className="lbl">Current stage</div><div className="v">{p.stage}</div><div className="s">Owner {p.owner?.name || 'not assigned'}</div></div>
        <div><div className="lbl">Timeline</div><div className="v">{p.cadenceLabel} · {p.term}</div><div className="s">{p.timeline}</div></div>
        <div><div className="lbl">Approved by client</div><div className="v">{p.approved} of {p.target || '?'}</div><div className="bar2" style={{ marginTop: 6 }}><i style={{ width: pct(p.approved, p.target) + '%' }} /></div></div>
        <div><div className="lbl">Client access</div><div className="v">{p.hasClientAccess ? 'Review link live' : 'Not invited'}</div><div className="s">No internal notes exposed</div></div>
      </div>

      <ProjectTabs slug={p.slug} type={p.type} on="" localTabs={tabs}
        activeLocalTab={tab} onLocalTab={setTab} />

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
            <div className="src"><div className="ic">▤</div><div className="tx"><div className="lbl">Contract</div><div className="v">{p.contract?.filename || 'Not uploaded'}</div><div className="s">Deliverable baseline and source agreement</div></div><button className="btn sm" onClick={openContract}>Open</button></div>
            <div className="src"><div className="ic">◫</div><div className="tx"><div className="lbl">Project brief / PRD</div><div className="v">{p.prd ? 'Working document ready' : 'Not started'}</div><div className="s">Versioned requirements</div></div><Link className="btn sm" href={'/projects/' + p.slug + '/prd'}>Open</Link></div>
            <div className="src"><div className="ic">✦</div><div className="tx"><div className="lbl">Client brand brain</div><div className="v">{p.voice ? 'Voice context written' : 'Context missing'}</div><div className="s">Managed separately from this round</div></div></div>
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
        <table>
          <thead><tr><th>What</th><th>Deliverable</th><th>Kind</th><th>Who</th><th>Due</th><th>State</th><th /></tr></thead>
          <tbody>
            {(p.work || []).map((w) => <tr key={w._id}>
              <td className="b">{w.title}</td><td>{w.deliverable || 'Not assigned'}</td><td>{KINDS[w.kind]?.label || w.kind}</td>
              <td>{w.assigneeName || 'Nobody'}</td><td className="dim">{w.due || 'Not set'}</td>
              <td><span className={'tag ' + (TAG[w.state] || 'mute')}>{LABEL[w.state] || w.state}</span></td>
              <td><Link className="btn sm" href={'/work/' + w._id}>Open</Link></td>
            </tr>)}
            {(p.work || []).length === 0 ? <tr><td colSpan={7} className="dim">No work items on this project yet.</td></tr> : null}
          </tbody>
        </table>
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
