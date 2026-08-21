import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { thisWeek, weekStart, summarise } from '../../../lib/calendar';
import { readProjectWeek } from '../../../lib/week';
import { thisMonth, monthLabel } from '../../../lib/cycles';
import { isLate } from '../../../lib/work';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);
const dayName = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// The prototype labels the monthly rhythm by ISO week, which is what the team
// already says out loud. Day of month would read as a date and confuse it.
function isoWeek(d) {
  const t = new Date(d + 'T00:00:00Z');
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  return 1 + Math.round((t - firstThursday) / (7 * 86400000));
}
const hoursSince = (t) => (t ? Math.round((Date.now() - new Date(t).getTime()) / 3600000) : 0);

// A comfortable load. Above this and somebody is being quietly overloaded.
const COMFORTABLE = 3;

export async function GET(req) {
  const who = meSlug();
  const week = new URL(req.url).searchParams.get('week') || thisWeek();
  const month = thisMonth();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [projects, work, escalations, weeks, requests, people] = await Promise.all([
      sanity(true).fetch(`*[_type=="project" && status=="active"]|order(name asc){
        slug,name,type,cadence,"client":client->name,"clientSlug":client->slug,"owner":owner->name,
        "ownerSlug":owner->slug,"cals":count(calendarSources[current==true])}`),
      sanity(true).fetch(`*[_type=="work" && !(state in ["done"])]{
        _id,title,state,due,needsCraft,"assignee":assignee->slug,"assigneeName":assignee->name,
        "projectName":project->name,"projectSlug":project->slug,feedback}`),
      sanity(true).fetch(`*[_type=="escalation" && !defined(resolvedAt)]|order(at desc){
        _id,at,reason,detail,raisedBy,hops,"owner":owner->slug,"ownerName":owner->name,"projectName":project->name}`),
      sanity(true).fetch(`*[_type=="weekReview"]{projectSlug,week,flags,clientDecisions,shipped,
        "shipAt":shipGate.at,"craftAt":craftGate.at,clientToken}`),
      sanity(true).fetch(`*[_type=="request" && state=="new"]{_id,what,"clientName":client->name,at}`),
      sanity(true).fetch(`*[_type=="person" && active==true]{slug,name}`),
    ]);

    const nameOf = {};
    for (const p of people) nameOf[p.slug] = p.name;

    /* ---------- calendar gaps, read through the cache ---------- */
    const social = projects.filter((p) => p.type === 'social' && p.cals);
    const gapRows = await Promise.all(social.map(async (p) => {
      try {
        const w = await readProjectWeek(p.slug, week);
        if (w.error) return { ...p, error: w.error };
        const sum = summarise(w.items, w.week);
        const gaps = w.items.filter((i) => i.week === w.week && i.pending).map((i) => ({
          date: i.date, type: i.type, title: i.title, missing: i.missing, sheetRow: i.sheetRow,
        }));
        return { ...p, ...sum, gaps, readAt: w.readAt, fromCache: w.fromCache };
      } catch (e) { return { ...p, error: (e.message || String(e)).slice(0, 120) }; }
    }));

    const byWeek = {};
    for (const w of weeks) byWeek[w.projectSlug + '|' + w.week] = w;

    /* ---------- the four numbers ---------- */
    const mine = work.filter((w) => w.assignee === who && !['approved', 'done'].includes(w.state));
    const atGate = work.filter((w) => ['submitted', 'craft', 'ship', 'client'].includes(w.state));
    const blockingWeeks = weeks.filter((w) => (w.flags || []).some((f) => f.severity === 'block') && !w.shipAt);
    const totalGaps = gapRows.reduce((a, r) => a + (r.pending || 0), 0);

    const kpis = [
      { label: 'Yours today', value: mine.length, note: mine.filter((w) => isLate(w)).length
          ? mine.filter((w) => isLate(w)).length + ' of them late' : 'nothing late', bad: mine.some((w) => isLate(w)) },
      { label: 'Blocked at a gate', value: atGate.length + blockingWeeks.length,
        note: blockingWeeks.length ? blockingWeeks.length + ' week(s) cannot ship' : 'across all clients',
        bad: !!blockingWeeks.length },
      { label: 'Calendar gaps', value: totalGaps,
        note: gapRows.filter((r) => r.pending).length + ' account(s)', bad: totalGaps > 0 },
      { label: 'Open decisions', value: escalations.length,
        note: escalations.filter((e) => hoursSince((e.hops || []).slice(-1)[0]?.at || e.at) > 48).length
          ? 'one has sat over two days' : 'none stale', bad: !!escalations.length },
    ];

    /* ---------- this month, per client ---------- */
    const monthWeeks = [];
    {
      let d = weekStart(month + '-01');
      for (let i = 0; i < 6; i++) {
        const iso = d;
        if (iso.slice(0, 7) <= month) monthWeeks.push(iso);
        const nd = new Date(d + 'T00:00:00Z'); nd.setUTCDate(nd.getUTCDate() + 7); d = nd.toISOString().slice(0, 10);
        if (d.slice(0, 7) > month) break;
      }
    }
    const rhythm = projects.filter((p) => p.type === 'social').map((p) => {
      const steps = monthWeeks.map((wk) => {
        const r = byWeek[p.slug + '|' + wk];
        const label = 'Wk ' + isoWeek(wk);
        if (!r) return { label, state: wk > today ? 'future' : 'nothing' };
        const answered = (r.clientDecisions || []).length;
        if (r.shipAt && answered) return { label, state: 'approved' };
        if (r.shipAt) return { label, state: 'withClient' };
        if ((r.flags || []).some((f) => f.severity === 'block')) return { label, state: 'incomplete' };
        if (r.craftAt) return { label, state: 'inProgress' };
        return { label, state: wk === week ? 'current' : 'nothing' };
      });
      return { slug: p.slug, name: p.client, project: p.name, owner: p.owner, steps };
    });

    /* ---------- needs attention, worst first ---------- */
    const attention = [];
    for (const w of weeks) {
      const changes = (w.clientDecisions || []).filter((d) => d.decision === 'changes');
      for (const c of changes) {
        const p = projects.find((x) => x.slug === w.projectSlug);
        attention.push({ rank: 1, kind: 'Client feedback',
          text: (p ? p.client : w.projectSlug) + ' asked for a change on ' + dayName(w.week),
          sub: (c.by || 'the client') + ': ' + (c.comment || 'no words given'),
          href: '/projects/' + w.projectSlug + '/review?week=' + w.week, action: 'Triage' });
      }
    }
    for (const w of blockingWeeks) {
      const p = projects.find((x) => x.slug === w.projectSlug);
      attention.push({ rank: 2, kind: 'Cannot ship',
        text: (p ? p.name : w.projectSlug) + ', week of ' + dayName(w.week),
        sub: (w.flags || []).filter((f) => f.severity === 'block').length + ' blocking flag(s) open',
        href: '/projects/' + w.projectSlug + '/review?week=' + w.week, action: 'Open' });
    }
    for (const w of work.filter((x) => isLate(x))) {
      attention.push({ rank: 3, kind: 'Late',
        text: w.title, sub: (w.assigneeName || 'nobody') + ', was due ' + dayName(w.due),
        href: '/work/' + w._id, action: 'Open' });
    }
    for (const e of escalations) {
      const h = hoursSince((e.hops || []).slice(-1)[0]?.at || e.at);
      if (h < 24) continue;
      attention.push({ rank: 4, kind: 'Waiting on a decision',
        text: e.reason, sub: 'with ' + (e.ownerName || 'nobody') + ' for ' + Math.round(h / 24) + ' day(s)',
        href: '/escalations', action: 'Open' });
    }
    const load = {};
    for (const w of work) if (w.assignee && !['approved', 'done'].includes(w.state)) load[w.assignee] = (load[w.assignee] || 0) + 1;
    for (const slug of Object.keys(load)) {
      if (load[slug] <= COMFORTABLE) continue;
      attention.push({ rank: 5, kind: 'Capacity',
        text: (nameOf[slug] || slug) + ' is on ' + load[slug] + ' jobs against a comfortable ' + COMFORTABLE,
        sub: 'Reassign one, or accept the dates will move', href: '/team', action: 'Open' });
    }
    for (const r of requests) {
      attention.push({ rank: 6, kind: 'Unplanned request',
        text: (r.clientName || 'A client') + ' asked for something',
        sub: String(r.what || '').slice(0, 120), href: '/requests', action: 'Decide' });
    }
    attention.sort((a, b) => a.rank - b.rank);

    /* ---------- the digest, named and specific ---------- */
    const digest = [];
    for (const r of gapRows) {
      if (r.error) { digest.push(r.name + ': calendar could not be read. ' + r.error); continue; }
      if (!r.pending) continue;
      const noCap = r.gaps.filter((g) => (g.missing || []).includes('caption')).length;
      const noCre = r.gaps.filter((g) => (g.missing || []).includes('creative')).length;
      const bits = [];
      if (noCre) bits.push(noCre + ' with no creative');
      if (noCap) bits.push(noCap + ' with no caption');
      const dates = r.gaps.map((g) => g.date).filter(Boolean);
      digest.push((r.owner || 'Unowned') + ': ' + r.client + ' has ' + r.pending + ' post'
        + (r.pending === 1 ? '' : 's') + ' outstanding this week, ' + bits.join(' and ')
        + (dates.length ? ', dated ' + dayName(dates[0]) + (dates.length > 1 ? ' to ' + dayName(dates[dates.length - 1]) : '') : ''));
    }
    for (const p of people) {
      const q = work.filter((w) => {
        if (['approved', 'done'].includes(w.state)) return false;
        if (w.state === 'craft' || (w.state === 'submitted' && w.needsCraft)) return softYes(can(p.slug, 'approveCraft'));
        if (w.state === 'ship' || (w.state === 'submitted' && !w.needsCraft)) return softYes(can(p.slug, 'shipGate'));
        if (w.state === 'client') return softYes(can(p.slug, 'triageFeedback'));
        return false;
      });
      if (q.length) digest.push(p.name + ': ' + q.length + ' item' + (q.length === 1 ? '' : 's')
        + ' waiting on your sign off, ' + q.slice(0, 3).map((w) => w.title).join(', ')
        + (q.length > 3 ? ' and ' + (q.length - 3) + ' more' : ''));
    }
    for (const e of escalations) {
      const h = hoursSince((e.hops || []).slice(-1)[0]?.at || e.at);
      digest.push('Decision with ' + (e.ownerName || 'nobody') + (h >= 24 ? ' for ' + Math.round(h / 24) + ' day(s)' : ' since today')
        + ': ' + e.reason + (e.projectName ? ' (' + e.projectName + ')' : ''));
    }
    for (const w of work.filter((x) => isLate(x)).slice(0, 6))
      digest.push((w.assigneeName || 'Nobody') + ': ' + w.title + ' was due ' + dayName(w.due) + ' and is not done');
    for (const slug of Object.keys(load))
      if (load[slug] > COMFORTABLE) digest.push((nameOf[slug] || slug) + ' is on ' + load[slug] + ' jobs against a comfortable ' + COMFORTABLE);
    for (const w of weeks) {
      if (!w.shipAt || !w.clientToken) continue;
      const answered = (w.clientDecisions || []).length;
      const total = w.shipped || 0;
      if (total && answered < total) {
        const p = projects.find((x) => x.slug === w.projectSlug);
        digest.push((p ? p.client : w.projectSlug) + ' has answered ' + answered + ' of ' + total
          + ' for the week of ' + dayName(w.week));
      }
    }
    for (const r of requests)
      digest.push('Unplanned ask from ' + (r.clientName || 'a client') + ', still undecided: ' + String(r.what || '').slice(0, 90));

    if (!digest.length) digest.push('Nothing outstanding. Every calendar is complete and no decision is waiting on anyone.');

    return Response.json({
      ok: true, who, week, month, monthLabel: monthLabel(month),
      kpis, rhythm, attention: attention.slice(0, 12), digest,
      gapRows: gapRows.map((r) => ({ slug: r.slug, name: r.name, client: r.client, owner: r.owner,
        total: r.total || 0, pending: r.pending || 0, gaps: (r.gaps || []).slice(0, 6), error: r.error || null })),
      readAt: gapRows.find((r) => r.readAt)?.readAt || null,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 240) });
  }
}
