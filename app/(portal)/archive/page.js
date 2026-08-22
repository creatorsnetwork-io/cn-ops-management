import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { KINDS } from '../../../lib/work';

export const dynamic = 'force-dynamic';

const when = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

export default async function Archive() {
  if (!pageAllowed(meSlug(), '/archive')) return <NotYours what="Archive" />;

  let projects = [], weeks = [], work = [], requests = [], escalations = [], error = null;
  try {
    [projects, weeks, work, requests, escalations] = await Promise.all([
      sanity(true).fetch(
        `*[_type=="project" && status in ["closed","archived","inactive"]]|order(_updatedAt desc){
        slug,name,type,closedAt,
        "client":client->name,
        "approved":count(*[_type=="work" && project._ref==^._id && state in ["approved","done"]]),
        "workTotal":count(*[_type=="work" && project._ref==^._id])}`),
      sanity(true).fetch(
        `*[_type=="weekReview" && defined(shipGate.at)]|order(week desc)[0...60]{
        week, projectSlug, shipped, clientDecisions, "shipAt": shipGate.at, "shipBy": shipGate.by,
        "override": shipGate.override, "projectName": project->name, "client": project->client->name }`),
      sanity(true).fetch(
        `*[_type=="work" && state=="done"]|order(_updatedAt desc)[0...80]{
        _id,title,kind,approvedBy,approvedAt,"projectName":project->name,"assigneeName":assignee->name}`),
      sanity(true).fetch(
        `*[_type=="request" && state != "new"]|order(decidedAt desc)[0...80]{
        _id,at,what,state,inScope,decision,"clientName":client->name,"workId":work->_id}`),
      sanity(true).fetch(
        `*[_type=="escalation" && defined(resolvedAt)]|order(resolvedAt desc)[0...80]{
        _id,at,who,reason,resolution,outcome,resolvedBy,resolvedAt,"ownerName":owner->name,"projectName":project->name}`),
    ]);
  } catch (e) { error = e.message; }

  const typeName = { social: 'Social', web: 'Website', seo: 'SEO', campaign: 'Campaign', video: 'Film and video' };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Closed and kept</div>
          <h1>Archive</h1>
          <p className="lede">Closed projects stay readable and searchable, out of active lists, with their operational record intact.</p>
        </div>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header><h2>Closing requires three things</h2></header>
        <table><tbody>
          <tr><td className="b" style={{ width: 210 }}>Deliverables reconciled</td><td className="dim">Approved against committed, with any shortfall explained in writing</td></tr>
          <tr><td className="b">Final files linked</td><td className="dim">Masters, exports and the last approved versions</td></tr>
          <tr><td className="b">Dispute pack generated</td><td className="dim">Timeline, approval snapshots, feedback verbatim and baseline versions</td></tr>
        </tbody></table>
      </div>

      <div className="panel">
        <header><h2>Archived, {projects.length}</h2></header>
        <table>
          <thead><tr><th>Client</th><th>Project</th><th>Service</th><th>Closed</th><th>Delivered</th><th /></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.slug}>
                <td className="b">{p.client || 'Not recorded'}</td>
                <td>{p.name}</td>
                <td className="dim">{typeName[p.type] || p.type || 'Not recorded'}</td>
                <td className="dim">{p.closedAt ? when(p.closedAt) : 'Date not recorded'}</td>
                <td className="dim">{p.approved} of {p.workTotal} work items approved</td>
                <td className="rowb">
                  <Link className="btn sm" href={'/projects/' + p.slug + '/pack'}>Dispute pack</Link>
                  <Link className="btn sm" href={'/projects/' + p.slug}>Open</Link>
                </td>
              </tr>))}
            {projects.length === 0 ? <tr><td colSpan={6} className="dim">No project has a closed or archived status yet.</td></tr> : null}
          </tbody>
        </table>
        <div className="pad" style={{ borderTop: '1px solid var(--line2)' }}><p className="note">The current project API cannot close a project or record a closure date. Existing non-active projects appear here; no closure values are invented.</p></div>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)', padding: '10px 2px' }}>Operational records kept alongside archived projects</summary>

      <div className="panel">
        <header><h2>Weeks that shipped</h2><span className="pill">{weeks.length}</span></header>
        <table>
          <thead><tr><th style={{ width: 170 }}>Project</th><th style={{ width: 130 }}>Week</th><th style={{ width: 96 }}>Posts</th><th style={{ width: 118 }}>Approved</th><th>Shipped by</th><th style={{ width: 128 }} /></tr></thead>
          <tbody>
            {weeks.map((w) => {
              const ap = (w.clientDecisions || []).filter((d) => d.decision === 'approved').length;
              return (
                <tr key={w.projectSlug + w.week}>
                  <td>{w.projectName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{w.client}</div></td>
                  <td className="dim">{dayOf(w.week)}</td>
                  <td>{w.shipped || 'Not recorded'}</td>
                  <td>{ap ? <span className="tag ok">{ap}</span> : <span className="tag mute">none</span>}</td>
                  <td>{w.shipBy}, {when(w.shipAt)}
                    {w.override ? <span className="tag warn" style={{ marginLeft: 6 }}>override</span> : null}</td>
                  <td><Link className="btn sm" href={'/projects/' + w.projectSlug + '/pack'}>Record</Link></td>
                </tr>);
            })}
            {weeks.length === 0 ? <tr><td colSpan={6} className="dim">No week has shipped yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <header><h2>Work closed</h2><span className="pill">{work.length}</span></header>
        <table>
          <thead><tr><th>What</th><th style={{ width: 155 }}>Kind</th><th style={{ width: 150 }}>Project</th><th style={{ width: 118 }}>Who did it</th><th>Approved by</th></tr></thead>
          <tbody>
            {work.map((w) => (
              <tr key={w._id}>
                <td><Link href={'/work/' + w._id}>{w.title}</Link></td>
                <td>{KINDS[w.kind]?.label || w.kind}</td>
                <td>{w.projectName}</td>
                <td>{w.assigneeName || 'Not recorded'}</td>
                <td>{w.approvedBy ? w.approvedBy + ', ' + when(w.approvedAt) : <span style={{ color: 'var(--faint)' }}>not recorded</span>}</td>
              </tr>))}
            {work.length === 0 ? <tr><td colSpan={5} className="dim">Nothing closed yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <header><h2>Requests decided</h2><span className="pill">{requests.length}</span></header>
        <table>
          <thead><tr><th style={{ width: 140 }}>Client</th><th>What they asked</th><th style={{ width: 108 }}>Scope</th><th style={{ width: 100 }}>Outcome</th><th>Reason given</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td>{r.clientName}<div className="dim" style={{ color: 'var(--faint)', fontSize: 12 }}>{when(r.at)}</div></td>
                <td>{r.what}</td>
                <td><span className={'tag ' + (r.inScope === 'no' ? 'bad' : r.inScope === 'yes' ? 'ok' : 'warn')}>
                  {r.inScope === 'no' ? 'outside' : r.inScope === 'yes' ? 'inside' : 'unclear'}</span></td>
                <td><span className={'tag ' + (r.state === 'accepted' ? 'ok' : r.state === 'declined' ? 'bad' : 'warn')}>{r.state}</span></td>
                <td>{r.decision || 'No reason recorded'}{r.workId ? <div><Link href={'/work/' + r.workId} style={{ fontSize: 12.5 }}>the work it became</Link></div> : null}</td>
              </tr>))}
            {requests.length === 0 ? <tr><td colSpan={5} className="dim">Nothing decided yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <header><h2>Escalations closed</h2><span className="pill">{escalations.length}</span></header>
        <table>
          <thead><tr><th style={{ width: 130 }}>Raised</th><th>Why</th><th style={{ width: 130 }}>Owned by</th><th style={{ width: 108 }}>Outcome</th><th>What happened</th></tr></thead>
          <tbody>
            {escalations.map((e) => (
              <tr key={e._id}>
                <td>{when(e.at)}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{e.who}</div></td>
                <td>{e.reason}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{e.projectName}</div></td>
                <td>{e.ownerName || 'Not recorded'}</td>
                <td><span className="tag mute">{e.outcome || 'fixed'}</span></td>
                <td>{e.resolution}<div style={{ color: 'var(--faint)', fontSize: 12 }}>closed by {e.resolvedBy}, {when(e.resolvedAt)}</div></td>
              </tr>))}
            {escalations.length === 0 ? <tr><td colSpan={5} className="dim">Nothing closed yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      </details>
    </>
  );
}
