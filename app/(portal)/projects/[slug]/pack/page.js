import Link from 'next/link';
import { sanity } from '../../../../../lib/sanity';
import { rollup } from '../../../../../lib/rollup';
import { LABEL, KINDS } from '../../../../../lib/work';
import PrintButton from '../../../../../components/PrintButton';
import ProjectTabs from '../../../../../components/ProjectTabs';

export const dynamic = 'force-dynamic';

// Sets the browser tab title, which is also what "Print / Save as PDF" uses
// as the suggested filename, so this stops printing out as "CN Ops Portal.pdf".
export async function generateMetadata({ params }) {
  try {
    const p = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{name,"client":client->name}', { s: params.slug });
    if (p) return { title: (p.client ? p.client + ' - ' : '') + p.name + ' - Record of approvals' };
  } catch (e) { /* falls through to the default title below */ }
  return { title: 'Record of approvals' };
}

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const dayOf = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

export default async function Pack({ params, searchParams }) {
  const from = (searchParams && searchParams.from) || '';
  const to = (searchParams && searchParams.to) || '';

  let p = null, snaps = [], roll = null, workItems = [], error = null;
  try {
    p = await sanity(true).fetch(
      `*[_type=="project" && slug==$s][0]{
        slug,name,type,deliverables,"client":client->{name},
        "workCount":count(*[_type=="work" && references(^._id)])
      }`, { s: params.slug });
    if (p) {
      [snaps, roll, workItems] = await Promise.all([
        sanity(true).fetch(
          `*[_type=="snapshot" && projectSlug==$s
            && ($from == "" || week >= $from) && ($to == "" || week <= $to)]|order(week asc, at asc){
          _id, at, by, decision, comment, itemKey, week, seen }`,
          { s: params.slug, from, to }),
        rollup(params.slug),
        sanity(true).fetch(
          `*[_type=="work" && project->slug==$s]|order(due asc){
          _id, title, kind, state, driveLink, approvedBy, approvedAt, history, feedback}`,
          { s: params.slug }),
      ]);
    }
  } catch (e) { error = e.message; }

  if (error) return <><h1>Record of approvals</h1><div className="alert">Sanity did not answer. <code>{error}</code></div></>;
  if (!p) return <><h1>Not found</h1><p className="lede"><Link href="/projects">Back to projects</Link></p></>;

  const weeks = {};
  for (const s of snaps) (weeks[s.week] = weeks[s.week] || []).push(s);
  const weekList = Object.keys(weeks).sort();
  const gates = {};
  for (const r of (roll?.rows || [])) gates[r.week] = r;

  return (
    <>
      <ProjectTabs slug={p.slug} type={p.type} on="/pack" workCount={p.workCount} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">{p.client?.name}</div>
          <h1>Record of approvals</h1>
          <p className="lede">
            {p.name}. Every decision the client made, with the exact wording and file that was on
            screen at the time. Prepared {when(new Date().toISOString())}.
            {from || to ? ' Covering ' + (from || 'the start') + ' to ' + (to || 'now') + '.' : ''}
          </p>
        </div>
        <PrintButton />
      </div>

      {roll ? (
        <div className="panel">
          <header><h2>Totals</h2><span className="pill">{weekList.length} week{weekList.length === 1 ? '' : 's'} with a decision</span></header>
          <div style={{ padding: '14px 16px' }}>
            <div className="stat">
              <div><b>{roll.totals.shipped}</b><span>submitted</span></div>
              <div><b>{roll.totals.approved}</b><span>approved</span></div>
              <div><b>{roll.totals.changes}</b><span>changes asked</span></div>
              <div><b>{roll.totals.waiting}</b><span>never answered</span></div>
            </div>
            {(p.deliverables || []).length ? (
              <p className="note" style={{ marginTop: 10 }}>
                Contracted: {(p.deliverables || []).map((d) => d.name + ' ' + d.target + ' per ' + d.period).join(', ')}.
                A deliverable is counted only on client approval
                {(p.deliverables || [])[0]?.acceptance ? ', defined as: ' + (p.deliverables || [])[0].acceptance : ''}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {workItems.length ? (
        <div className="panel">
          <header><h2>Work item record</h2><span className="pill">{workItems.length} item{workItems.length === 1 ? '' : 's'}</span></header>
          <div style={{ padding: '13px 16px' }}>
            {workItems.map((w) => (
              <div className="pk" key={w._id}>
                <div className="pkh">
                  <b>{w.title}</b>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>{(KINDS[w.kind] || {}).label || w.kind}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span className={'tag ' + (['approved', 'done'].includes(w.state) ? 'ok' : 'mute')}>{LABEL[w.state] || w.state}</span>
                  {w.approvedBy ? <> &middot; approved by <b>{w.approvedBy}</b> on {when(w.approvedAt)}</> : null}
                </div>
                {w.driveLink ? (
                  <div style={{ fontSize: 12.5, marginTop: 7 }}>
                    File: <a href={w.driveLink} target="_blank" rel="noreferrer">{w.driveLink}</a>
                  </div>) : null}
                {(w.feedback || []).map((f, i) => (
                  <div key={f._key || i} style={{ marginTop: 5, color: 'var(--bad)' }}>
                    Their words: &ldquo;{f.text}&rdquo;{f.resolved ? ', resolved by ' + (f.resolvedBy || 'the team') : ''}
                  </div>
                ))}
                {(w.history || []).length ? (
                  <div style={{ marginTop: 7, fontSize: 12, color: 'var(--faint)' }}>
                    {w.history.map((h, i) => (
                      <div key={h._key || i}>
                        {when(h.at)} &mdash; {h.who} moved it {h.from ? 'from ' + h.from + ' ' : ''}to {h.to}
                        {h.clientName ? ', client: ' + h.clientName : ''}{h.note ? ', ' + h.note : ''}
                      </div>
                    ))}
                  </div>) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {weekList.length === 0 ? (
        <div className="panel"><div className="empty">
          No weekly review has been shared with the client for this project yet. Once a client approves
          through a review link, every decision lands here permanently.
        </div></div>
      ) : null}

      {weekList.map((w) => (
        <div className="panel" key={w}>
          <header>
            <h2>Week of {dayOf(w)}</h2>
            <span className="pill">
              {gates[w]?.craftBy ? 'creative signed by ' + gates[w].craftBy : 'creative gate not signed'}
              {gates[w]?.shipBy ? ', shipped by ' + gates[w].shipBy + (gates[w].override ? ' with an override' : '') : ''}
            </span>
          </header>
          <div style={{ padding: '13px 16px' }}>
            {weeks[w].map((s) => (
              <div className="pk" key={s._id}>
                <div className="pkh">
                  <b>{s.seen?.title || s.seen?.type || s.itemKey}</b>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>
                    {s.seen?.date ? dayOf(s.seen.date) + ' · ' : ''}{s.seen?.type || ''} · sheet reference {s.itemKey}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span className={'tag ' + (s.decision === 'approved' ? 'ok' : 'bad')}>
                    {s.decision === 'approved' ? 'approved' : 'changes requested'}
                  </span>{' '}
                  by <b>{s.by}</b> on {when(s.at)}
                  {s.comment ? <div style={{ marginTop: 5, color: 'var(--bad)' }}>Their words: “{s.comment}”</div> : null}
                </div>
                {s.seen?.creative ? (
                  <div style={{ fontSize: 12.5, marginTop: 7 }}>
                    File they saw: <a href={s.seen.creative} target="_blank" rel="noreferrer">{s.seen.creative}</a>
                  </div>) : null}
                {s.seen?.captions ? <pre>{s.seen.captions}</pre> : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="note">
        Each entry is written at the moment the client presses the button and is never edited afterwards.
        The sheet reference and content signature let any row be traced back to the calendar as it stood
        that day, even if the sheet has changed since.
      </p>
    </>
  );
}
