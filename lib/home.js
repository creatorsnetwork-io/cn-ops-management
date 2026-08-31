import { sanity } from './sanity';
import { thisWeek, weekStart } from './calendar';
import { thisMonth, monthLabel } from './cycles';
import { can } from './perm';

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);
const days = (t) => (t ? Math.floor((Date.now() - new Date(t).getTime()) / 86400000) : 0);

// Every Monday inside a month, so the chain has one step per week the way the
// prototype draws it.
function weeksOfMonth(month) {
  const first = new Date(month + '-01T00:00:00Z');
  const out = [];
  const d = new Date(first);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  while (true) {
    const iso = d.toISOString().slice(0, 10);
    const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6);
    if (end.toISOString().slice(0, 7) > month && iso.slice(0, 7) > month) break;
    if (end.toISOString().slice(0, 7) >= month) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 7);
    if (out.length > 6) break;
  }
  return out;
}
const weekNo = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  const jan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jan) / 86400000 + jan.getUTCDay() + 1) / 7);
};

export async function homeData(who) {
  const month = thisMonth();
  const week = thisWeek();
  const today = new Date().toISOString().slice(0, 10);

  const d = await sanity(true).fetch(
    `{
      "projects": *[_type=="project" && status=="active"]{
        slug, name, type, cadence, "client": client->name, "clientSlug": client->slug,
        "owner": owner->slug, "ownerName": owner->name,
        "cals": count(calendarSources[current==true])},
      "weeks": *[_type=="weekReview"]{projectSlug, week, shipped, clientToken, sharedAt,
        clientDecisions, flags, "shipAt": shipGate.at, "craftAt": craftGate.at},
      "months": *[_type=="monthCycle" && month==$month]{projectSlug, month, reportLink,
        brainstormAt, ideasSentAt, ideasApprovedAt, "shipAt": shipGate.at, clientAck},
      "work": *[_type=="work" && !(state in ["approved","done"])]{
        _id, title, state, due, needsCraft, "assignee": assignee->slug, "assigneeName": assignee->name,
        "projectName": project->name, "projectSlug": project->slug,
        "openFeedback": count(feedback[resolved != true])},
      "escalations": *[_type=="escalation" && !defined(resolvedAt)]{
        _id, at, reason, detail, hops, raisedBy, "owner": owner->slug, "ownerName": owner->name,
        "projectName": project->name},
      "requests": *[_type=="request" && state=="new"]{_id, at, what, "clientName": client->name, inScope},
      "vendors": *[_type=="vendor" && active==true]{_id, name, jobs},
      "people": *[_type=="person" && active==true]{slug, name}
    }`, { month });

  const socials = d.projects.filter((p) => p.type === 'social');
  const wkBy = {};
  for (const w of d.weeks) wkBy[w.projectSlug + '|' + w.week] = w;
  const moBy = {};
  for (const m of d.months) moBy[m.projectSlug] = m;

  // ---- the monthly chain, per social project ----
  const cycle = socials.map((p) => {
    const m = moBy[p.slug] || {};
    const steps = [];

    // Not recorded is not the same as not held. The portal did not exist for
    // most of these months, so an empty field is silence, not a failure.
    steps.push(m.brainstormAt ? ['Brainstorm', 'done'] : ['Brainstorm', '']);

    if (m.ideasApprovedAt) steps.push(['Ideas approved', 'done']);
    else if (m.ideasSentAt) steps.push(['Ideas with client, ' + days(m.ideasSentAt) + ' days', 'wait']);
    else steps.push(['Ideas', '']);

    for (const wk of weeksOfMonth(month)) {
      const w = wkBy[p.slug + '|' + wk] || {};
      const decided = (w.clientDecisions || []).length;
      const approved = (w.clientDecisions || []).filter((x) => x.decision === 'approved').length;
      const blocking = (w.flags || []).filter((f) => f.severity === 'block').length;
      const label = 'Wk ' + weekNo(wk);

      const tracked = !!wkBy[p.slug + '|' + wk];

      if (w.shipAt && w.shipped && approved >= w.shipped) steps.push([label, 'done']);
      else if (w.clientToken && decided < (w.shipped || 1)) steps.push([label + ', with client', 'now']);
      else if (wk === week) steps.push([label + (blocking ? ', QC' : ''), blocking ? 'stuck' : 'now']);
      // A past week only counts as incomplete if the portal was actually used for
      // it. Otherwise the chain would blame the team for weeks it never saw.
      else if (wk < week && tracked && !w.shipAt) steps.push([label + ', incomplete', 'stuck']);
      else steps.push([label, '']);
    }

    steps.push(m.shipAt ? ['Report', 'done'] : m.reportLink ? ['Report drafted', 'wait'] : ['Report', '']);
    return { slug: p.slug, client: p.client, name: p.name, steps };
  });

  // ---- the four tiles ----
  const mine = d.work.filter((w) => w.assignee === who);
  const atGate = d.work.filter((w) => ['submitted', 'craft', 'ship', 'client'].includes(w.state));
  const weeksBlocked = d.weeks.filter((w) => !w.shipAt && (w.flags || []).some((f) => f.severity === 'block')).length;
  const late = d.work.filter((w) => w.due && w.due < today);
  const openEsc = d.escalations.filter((e) => (['himanshu', 'aashif'].includes(who) ? true : (e.owner === who || e.raisedBy === who)));

  // ---- needs attention, ordered by consequence ----
  const attention = [];
  const changes = d.weeks.reduce((a, w) => a + (w.clientDecisions || []).filter((x) => x.decision === 'changes').length, 0);
  const workFb = d.work.reduce((a, w) => a + (w.openFeedback || 0), 0);
  if (changes + workFb)
    attention.push({ k: 'Client feedback', t: (changes + workFb) + ' item' + (changes + workFb === 1 ? '' : 's') + ' the client asked to change', s: 'Nothing moves until these are answered', href: '/feedback', dot: 'bad', btn: 'Triage' });

  if (late.length)
    attention.push({ k: 'Late', t: late.length + ' piece' + (late.length === 1 ? '' : 's') + ' of work past its date', s: late.slice(0, 2).map((w) => w.title).join(', '), href: '/work', dot: 'bad', btn: 'Open' });

  if (weeksBlocked)
    attention.push({ k: 'Quality', t: weeksBlocked + ' week' + (weeksBlocked === 1 ? '' : 's') + ' cannot ship', s: 'Blocking flags still open', href: '/qc', dot: 'bad', btn: 'Open' });

  const load = {};
  for (const w of d.work) if (w.assignee) load[w.assignee] = (load[w.assignee] || 0) + 1;
  const over = Object.keys(load).filter((k) => load[k] > 3).sort((a, b) => load[b] - load[a]);
  if (over.length) {
    const nm = (d.people.find((p) => p.slug === over[0]) || {}).name || over[0];
    attention.push({ k: 'Capacity', t: nm + ' is at ' + load[over[0]] + ' jobs against a comfortable three', s: over.length > 1 ? over.length + ' people over' : 'One person over', href: '/team', dot: 'warn', btn: 'Open' });
  }

  for (const v of d.vendors) {
    const jobs = v.jobs || [];
    if (jobs.length < 2) continue;
    const redo = jobs.filter((j) => j.score === 3).length;
    if (redo / jobs.length > 0.33) {
      attention.push({ k: 'Vendor quality', t: v.name + ' had ' + redo + ' of ' + jobs.length + ' jobs redone', s: 'Rework is the cost that does not show on an invoice', href: '/vendors', dot: 'warn', btn: 'Open' });
      break;
    }
  }

  const noCal = socials.filter((p) => !p.cals);
  if (noCal.length)
    attention.push({ k: 'Setup', t: noCal.length + ' social project' + (noCal.length === 1 ? '' : 's') + ' with no calendar linked', s: noCal.map((p) => p.name).join(', '), href: '/projects/' + noCal[0].slug, dot: 'teal', btn: 'Set up' });

  if (d.requests.length)
    attention.push({ k: 'Inbound', t: d.requests.length + ' request' + (d.requests.length === 1 ? '' : 's') + ' with no decision', s: d.requests.slice(0, 2).map((r) => (r.clientName || '') + ': ' + String(r.what || '').slice(0, 50)).join(' · '), href: '/requests', dot: 'warn', btn: 'Decide' });

  const noBrainstorm = cycle.filter((c) => c.steps[0][1] === '').length;
  if (noBrainstorm)
    attention.push({ k: 'Rhythm', t: noBrainstorm + ' account' + (noBrainstorm === 1 ? '' : 's') + ' with no brainstorm recorded this month',
      s: 'Not recorded is not the same as not held. Mark it on the chain above.', href: '/', dot: 'teal', btn: 'Mark it' });

  // ---- the digest, as lines meant to be pasted ----
  const digest = [];
  const owed = openEsc.filter((e) => e.owner === 'himanshu').length;
  if (openEsc.length)
    digest.push(openEsc.length + ' decision' + (openEsc.length === 1 ? '' : 's') + ' open'
      + (owed ? ', ' + owed + ' sitting with Himanshu' : ', none with Himanshu'));
  if (weeksBlocked) digest.push(weeksBlocked + ' week' + (weeksBlocked === 1 ? '' : 's') + ' blocked by quality flags');
  if (changes + workFb) digest.push((changes + workFb) + ' client change' + (changes + workFb === 1 ? '' : 's') + ' waiting on a reply');
  if (late.length) digest.push(late.length + ' piece' + (late.length === 1 ? '' : 's') + ' of work past its date');
  if (over.length) {
    const nm = (d.people.find((p) => p.slug === over[0]) || {}).name || over[0];
    digest.push(nm + ' is at ' + load[over[0]] + ' jobs against a comfortable 3');
  }
  if (d.requests.length) digest.push(d.requests.length + ' unplanned request' + (d.requests.length === 1 ? '' : 's') + ' not yet decided');
  for (const c of cycle) {
    const stuck = c.steps.filter((s) => s[1] === 'stuck');
    if (stuck.length) digest.push(c.client + ': ' + stuck.map((s) => s[0].toLowerCase()).join(', '));
    const waiting = c.steps.filter((s) => s[1] === 'wait');
    if (waiting.length) digest.push(c.client + ': ' + waiting.map((s) => s[0].toLowerCase()).join(', '));
  }
  if (!digest.length) digest.push('Nothing outstanding. Every gate signed, no decisions waiting.');

  return {
    who, month, monthName: monthLabel(month), week,
    kpi: {
      mine: mine.length,
      atGate: atGate.length + weeksBlocked,
      decisions: openEsc.length,
      late: late.length,
    },
    cycle, attention: attention.slice(0, 6), digest,
    escalations: openEsc.filter((e) => e.owner === who).slice(0, 6),
    myWork: mine.slice(0, 8),
    canSeeCalendars: softYes(await can(who, 'shareClientLink')) || ['himanshu', 'aashif', 'priyanka', 'nayeem'].includes(who),
  };
}
