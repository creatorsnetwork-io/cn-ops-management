import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { LABEL, TAG } from '../../../lib/work';

export const dynamic = 'force-dynamic';

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (w) => (w ? new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

export default async function Feedback() {
  if (!pageAllowed(meSlug(), '/feedback')) return <NotYours what="Client feedback" />;

  let weeks = [], work = [], error = null;
  try {
    weeks = await sanity(true).fetch(
      `*[_type=="weekReview" && count(clientDecisions[decision=="changes"]) > 0]|order(week desc)[0...40]{
        week, projectSlug, clientDecisions, flags,
        "projectName": project->name, "client": project->client->name }`);
    work = await sanity(true).fetch(
      `*[_type=="work" && count(feedback[resolved != true]) > 0]|order(_createdAt desc)[0...60]{
        _id, title, state, feedback, "projectName": project->name, "client": project->client->name,
        "assigneeName": assignee->name }`);
  } catch (e) { error = e.message; }

  const social = [];
  for (const w of weeks) {
    const labels = {};
    for (const f of w.flags || []) if (f.label) labels[f.key] = f.label;
    for (const d of (w.clientDecisions || []).filter((x) => x.decision === 'changes')) {
      social.push({ ...d, week: w.week, projectSlug: w.projectSlug, projectName: w.projectName, client: w.client, label: labels[d.key] || d.key });
    }
  }
  const workOpen = work.flatMap((w) => (w.feedback || []).filter((f) => !f.resolved).map((f) => ({ ...f, item: w })));

  return (
    <>
      <div className="eyebrow">Quality</div>
      <h1>Client feedback</h1>
      <p className="lede">
        Everything a client asked to be changed, in their words, still open. {social.length + workOpen.length
          ? social.length + workOpen.length + ' waiting.'
          : 'Nothing waiting.'}
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}

      <div className="panel">
        <header><h2>On social posts</h2><span className="pill">{social.length}</span></header>
        <table className="tbl">
          <thead><tr><th style={{ width: 168 }}>Project</th><th style={{ width: 92 }}>Week</th><th style={{ width: 210 }}>Which post</th><th>What they said</th><th style={{ width: 128 }} /></tr></thead>
          <tbody>
            {social.map((d, n) => (
              <tr key={n}>
                <td>{d.projectName}<div style={{ color: 'var(--faint)', fontSize: 12 }}>{d.client}</div></td>
                <td className="mono">{dayOf(d.week)}</td>
                <td>{d.label}</td>
                <td>“{d.comment || 'no words, just changes'}”
                  <div style={{ color: 'var(--faint)', fontSize: 12, marginTop: 3 }}>{d.by} · {when(d.at)}</div></td>
                <td><Link className="btn sm" href={'/projects/' + d.projectSlug + '/review?week=' + d.week}>The week</Link></td>
              </tr>))}
            {social.length === 0 ? <tr><td colSpan={5} className="empty">Nothing outstanding on a calendar.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <header><h2>On other work</h2><span className="pill">{workOpen.length}</span></header>
        <table className="tbl">
          <thead><tr><th>What</th><th style={{ width: 150 }}>Project</th><th style={{ width: 110 }}>Who has it</th><th>What was asked</th><th style={{ width: 128 }}>State</th></tr></thead>
          <tbody>
            {workOpen.map((f, n) => (
              <tr key={n}>
                <td><Link href={'/work/' + f.item._id}>{f.item.title}</Link></td>
                <td>{f.item.projectName}</td>
                <td>{f.item.assigneeName || <span className="tag warn">nobody</span>}</td>
                <td>{f.text}<div style={{ color: 'var(--faint)', fontSize: 12, marginTop: 3 }}>
                  {f.who === 'client' ? 'the client' : f.who} · {when(f.at)}</div></td>
                <td><span className={'tag ' + (TAG[f.item.state] || 'mute')}>{LABEL[f.item.state]}</span></td>
              </tr>))}
            {workOpen.length === 0 ? <tr><td colSpan={5} className="empty">Nothing outstanding on a work item.</td></tr> : null}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          Feedback is marked handled on the item's own page, not from here, so whoever closes it has read the item first.
        </div>
      </div>
    </>
  );
}
