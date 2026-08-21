import Link from 'next/link';
import { sanity } from '../../../../lib/sanity';
import { me } from '../../../../lib/me';
import { can } from '../../../../lib/perm';
import CalendarSources from '../../../../components/CalendarSources';
import Deliverables from '../../../../components/Deliverables';
import Contract from '../../../../components/Contract';
import MonthCycle from '../../../../components/MonthCycle';
import Milestones from '../../../../components/Milestones';
import { LABEL, TAG, KINDS } from '../../../../lib/work';
import ProjectTabs from '../../../../components/ProjectTabs';

export const dynamic = 'force-dynamic';

const TYPE = { social:'Social retainer', website:'Website', seo:'SEO', influencer:'Influencer', video:'Video', aiVideo:'AI video' };

export default async function Project({ params }) {
  let p = null, error = null, who = { slug: 'himanshu' };
  try {
    who = await me();
    p = await sanity(true).fetch(
      `*[_type=="project" && slug==$s][0]{slug,name,type,cadence,status,calendarSources,deliverables,
        contract, milestones,
        "client":client->{name,code,driveFolderId},"owner":owner->{name,slug},
        "work": *[_type=="work" && references(^._id)]|order(due asc)[0...40]{
          _id,title,kind,state,due,"assigneeName":assignee->name}}`, { s: params.slug });
  } catch (e) { error = e.message; }

  if (error) return <><h1>Project</h1><div className="alert">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede">No project with the name <code>{params.slug}</code>. <Link href="/projects">Back to projects</Link></p></>;

  const canEdit = can(who.slug, 'editCalendarSources') === 'yes';

  return (
    <>
      <div className="eyebrow">{p.client?.name}</div>
      <h1>{p.name}</h1>
      <p className="lede">{TYPE[p.type] || p.type}, tracked {p.cadence}. Owned by {p.owner?.name || 'nobody yet'}.</p>

      <ProjectTabs slug={p.slug} type={p.type} on="" />

      <div className="grid g3">
        <div className="card">
          <div className="k">Where the files live</div>
          {p.client?.driveFolderId
            ? <p style={{ marginTop: 8 }}><a target="_blank" rel="noreferrer" href={'https://drive.google.com/drive/folders/' + p.client.driveFolderId}>Open the {p.client.code} Drive folder</a></p>
            : <p style={{ marginTop: 8, color: 'var(--faint)' }}>No Drive folder linked for this client.</p>}
        </div>
        <div className="card">
          <div className="k">Dispute pack</div>
          <p style={{ marginTop: 8 }}>
            Every client approval with the exact wording and file they saw.
            <br /><a href={'/projects/' + p.slug + '/pack'}>Open the record</a>
          </p>
        </div>
      </div>

      {p.cadence === 'monthly' ? <MonthCycle slug={p.slug} /> : null}
      {p.cadence === 'milestone'
        ? <Milestones slug={p.slug} initial={p.milestones || []} canAdd={['himanshu', 'aashif'].includes(who.slug)} />
        : null}
      {p.cadence === 'perAsset' ? (
        <div className="guard" style={{ marginTop: 20 }}>
          This project is tracked one asset at a time, so each asset is a work item below rather than a
          cycle. Nothing extra to keep up to date.
        </div>) : null}

      <div className="panel">
        <header>
          <h2>Work on this project</h2>
          <Link className="btn sm" href="/work">All work</Link>
        </header>
        <table className="tbl">
          <thead><tr><th>What</th><th style={{ width: 150 }}>Kind</th><th style={{ width: 110 }}>Who</th><th style={{ width: 92 }}>Due</th><th style={{ width: 124 }}>State</th></tr></thead>
          <tbody>
            {(p.work || []).map((w) => (
              <tr key={w._id}>
                <td><Link href={'/work/' + w._id}>{w.title}</Link></td>
                <td>{KINDS[w.kind]?.label || w.kind}</td>
                <td>{w.assigneeName || <span className="tag warn">nobody</span>}</td>
                <td className="mono">{w.due || '—'}</td>
                <td><span className={'tag ' + (TAG[w.state] || 'mute')}>{LABEL[w.state] || w.state}</span></td>
              </tr>))}
            {(p.work || []).length === 0
              ? <tr><td colSpan={5} className="empty">No work items on this project yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Contract slug={p.slug} contract={p.contract} canEdit canUpload={can(who.slug, 'uploadContract') === 'yes'} />

      <Deliverables slug={p.slug} initial={p.deliverables || []} canEdit={can(who.slug, 'editDeliverables') === 'yes'} />

      {p.type === 'social'
        ? <CalendarSources slug={p.slug} initial={p.calendarSources || []} canEdit={canEdit} />
        : null}
    </>
  );
}
