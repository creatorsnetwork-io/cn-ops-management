import Link from 'next/link';
import HomeBoard from '../../components/HomeBoard';
import Raise from '../../components/Raise';
import { meSlug } from '../../lib/me';
import { sanity } from '../../lib/sanity';
import { thisWeek } from '../../lib/calendar';
import { leadNameOf, sittingHours } from '../../lib/escalate';
import { LABEL, TAG, isLate } from '../../lib/work';

export const dynamic = 'force-dynamic';

// The prototype changes the heading by role, because what Aashif opens this screen
// for is not what Unnati opens it for.
const HEADS = {
  himanshu: ['Operations, without the hunt', 'Clients, contracted deliverables and live production in one place.'],
  aashif: ['Delivery operations', 'What is moving, what is stuck, and what needs signing.'],
  priyanka: ['Accounts you lead', 'Your clients, their calendars, and what is waiting on you.'],
  shelly: ['Creative, waiting on you', 'What needs your eye, and what your team is carrying.'],
};
const DEFAULT_HEAD = ['Your work', 'What is assigned to you, and what is waiting on a decision.'];
const OVERVIEW = ['himanshu', 'aashif', 'priyanka', 'nayeem'];
const when = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

export default async function Home() {
  const who = meSlug();
  let mineWork = [], mineEsc = [], raisedByMe = [], leadName = null;
  try {
    const s = who;
    [mineWork, mineEsc, raisedByMe, leadName] = await Promise.all([
      sanity(true).fetch(`*[_type=="work" && assignee->slug==$s && !(state in ["approved","done"])]|order(due asc)[0...25]{
        _id,title,state,due,"projectName":project->name}`, { s }),
      sanity(true).fetch(`*[_type=="escalation" && owner->slug==$s && !defined(resolvedAt)]|order(at desc)[0...15]{
        _id,at,reason,detail,hops,"projectName":project->name}`, { s }),
      sanity(true).fetch(`*[_type=="escalation" && raisedBy==$s && owner->slug != $s && !defined(resolvedAt)]|order(at desc)[0...15]{
        _id,at,reason,hops,"ownerName":owner->name,"projectName":project->name}`, { s }),
      leadNameOf(s),
    ]);
  } catch (e) {}

  const [title, lede] = HEADS[who] || DEFAULT_HEAD;
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const late = mineWork.filter((w) => isLate(w)).length;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow n">{dateLine}</div>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
        <div className="rowb">
          <Link className="btn" href="/requests">Log a request</Link>
          {OVERVIEW.includes(who) ? <Link className="btn" href="/calendar">Calendars</Link> : null}
        </div>
      </div>

      {mineEsc.length ? (
        <div className="panel">
          <header><h2>Sitting with you</h2><span className="tag bad">{mineEsc.length}</span></header>
          {mineEsc.map((e) => (
            <div className="row" key={e._id}>
              <span className="dot no" />
              <div className="t"><b>{e.reason}</b>
                <span>{e.projectName ? e.projectName + ' · ' : ''}{sittingHours(e)}h with you{e.detail ? ' · ' + e.detail : ''}</span></div>
              <Link className="btn sm" href="/escalations">Deal with it</Link>
            </div>))}
        </div>) : null}

      {mineWork.length ? (
        <div className="panel">
          <header>
            <h2>Your work</h2>
            {late ? <span className="tag bad">{late} late</span> : <span className="tag ok">nothing late</span>}
          </header>
          <table className="tbl">
            <thead><tr><th>What</th><th style={{ width: 170 }}>Project</th><th style={{ width: 92 }}>Due</th><th style={{ width: 128 }}>State</th></tr></thead>
            <tbody>
              {mineWork.map((w) => (
                <tr key={w._id}>
                  <td><Link href={'/work/' + w._id}>{w.title}</Link></td>
                  <td className="dim">{w.projectName}</td>
                  <td className="mono">{when(w.due) || '—'}{isLate(w) ? <div><span className="tag bad">late</span></div> : null}</td>
                  <td><span className={'tag ' + (TAG[w.state] || 'mute')}>{LABEL[w.state]}</span></td>
                </tr>))}
            </tbody>
          </table>
        </div>) : null}

      {raisedByMe.length ? (
        <div className="panel">
          <header><h2>You are waiting on someone</h2><span className="pill">{raisedByMe.length}</span></header>
          {raisedByMe.map((e) => (
            <div className="row" key={e._id}>
              <span className="dot no" />
              <div className="t"><b>{e.reason}</b>
                <span>With {e.ownerName || 'nobody'} for {sittingHours(e)}h{e.projectName ? ' · ' + e.projectName : ''}</span></div>
            </div>))}
        </div>) : null}

      {OVERVIEW.includes(who) ? <HomeBoard startWeek={thisWeek()} /> : null}

      <Raise leadName={leadName} label="I need a decision on something" />
    </>
  );
}
