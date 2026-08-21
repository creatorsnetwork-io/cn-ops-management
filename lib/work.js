import { can, scopeOf } from './perm';

// Who this person may hand work to. null means anyone.
export function assignableTo(who) {
  const v = can(who, 'assignWork');
  if (v === 'no') return [];
  if (v === 'yes') return null;
  const s = scopeOf(who);
  if (s.all) return null;
  return s.people || [who];
}

export function canCreateWork(who) {
  return can(who, 'createWork') !== 'no';
}

// A lead may move work around inside their own team, and may pick up work that
// nobody is on. They may not take an item off somebody else's person.
export function canAssign(item, who) {
  const list = assignableTo(who);
  if (list === null) return { ok: true, list: null };
  if (!list.length) return { ok: false, why: 'Your role does not assign work.', list: [] };
  if (item && item.assignee && !list.includes(item.assignee))
    return { ok: false, why: 'This is with ' + (item.assigneeName || 'someone outside your team') + ', so it is not yours to move.', list };
  return { ok: true, list };
}

// Nothing belongs in a list unless a verb moves it. This file is the only place
// that decides what can move, who can move it, and what it becomes.

export const STATES = ['briefed', 'progress', 'submitted', 'craft', 'ship', 'client', 'approved', 'done'];

export const LABEL = {
  briefed: 'Briefed', progress: 'In progress', submitted: 'Submitted',
  craft: 'With Shelly', ship: 'At ship gate', client: 'With client',
  approved: 'Client approved', done: 'Done',
};

export const TAG = {
  briefed: 'mute', progress: 'info', submitted: 'tl', craft: 'warn',
  ship: 'warn', client: 'warn', approved: 'ok', done: 'ok',
};

export const KINDS = {
  page: { label: 'Website page', craft: true },
  article: { label: 'Article or copy', craft: false },
  report: { label: 'Report', craft: false },
  asset: { label: 'Design asset', craft: true },
  film: { label: 'Film or video', craft: true },
  aivideo: { label: 'AI video', craft: true },
  campaign: { label: 'Creator campaign', craft: true },
  other: { label: 'Something else', craft: true },
};

// A verb: where it can act from, where it lands, who is allowed, what it needs.
export const VERBS = {
  start: { from: ['briefed'], to: 'progress', label: 'Start work', by: 'assignee' },
  submit: { from: ['progress'], to: 'submitted', label: 'Submit output', by: 'assignee', needLink: true },
  toCraft: { from: ['submitted'], to: 'craft', label: 'Send to Shelly', by: 'ops' },
  craftOk: { from: ['submitted', 'craft'], to: 'ship', label: 'Approve the creative', perm: 'approveCraft' },
  craftBack: { from: ['submitted', 'craft'], to: 'progress', label: 'Ask for changes', perm: 'approveCraft', needNote: true },
  shipOk: { from: ['ship', 'submitted'], to: 'client', label: 'Sign the ship gate', perm: 'shipGate' },
  shipBack: { from: ['ship'], to: 'progress', label: 'Send it back', perm: 'shipGate', needNote: true },
  clientOk: { from: ['client'], to: 'approved', label: 'Client approved', perm: 'triageFeedback', needWho: true },
  clientBack: { from: ['client'], to: 'progress', label: 'Client asked for changes', perm: 'triageFeedback', needNote: true },
  close: { from: ['approved'], to: 'done', label: 'Close it', perm: 'shipGate' },
  reopen: { from: ['done'], to: 'progress', label: 'Reopen', perm: 'shipGate', needNote: true },
};

const OPS = ['himanshu', 'aashif'];
const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);

// Why a verb is or is not available, in words, so a blocked screen explains itself.
export function verbCheck(name, item, who) {
  const v = VERBS[name];
  if (!v) return { ok: false, why: 'That is not a verb.' };
  if (!v.from.includes(item.state)) return { ok: false, why: 'Only possible when the item is ' + v.from.map((s) => LABEL[s]).join(' or ') + '.' };

  if (name === 'shipOk' && item.state === 'submitted' && item.needsCraft)
    return { ok: false, why: 'This kind of work needs Shelly to sign the creative first.' };
  if (name === 'toCraft' && !item.needsCraft)
    return { ok: false, why: 'This kind of work does not go through creative sign off.' };

  if (v.by === 'assignee') {
    if (item.assignee !== who && !OPS.includes(who))
      return { ok: false, why: 'Only ' + (item.assigneeName || 'the person it is assigned to') + ' can do this.' };
    return { ok: true };
  }
  if (v.by === 'ops') {
    if (!OPS.includes(who)) return { ok: false, why: 'Only Himanshu or Aashif can do this.' };
    return { ok: true };
  }
  if (v.perm) {
    if (!softYes(can(who, v.perm))) return { ok: false, why: 'Your role does not sign this off.' };
    return { ok: true };
  }
  return { ok: true };
}

export function verbsFor(item, who) {
  return Object.keys(VERBS)
    .map((name) => ({ name, ...VERBS[name], ...verbCheck(name, item, who) }))
    .filter((v) => v.from.includes(item.state));
}

// What each person is allowed to see, so nobody scrolls past work that is not theirs.
export function scopeFilter(items, who, tab) {
  const s = scopeOf(who);
  const mine = (i) => i.assignee === who;
  const toMe = (i) => {
    if (i.state === 'craft' && softYes(can(who, 'approveCraft'))) return true;
    if (i.state === 'submitted' && i.needsCraft && softYes(can(who, 'approveCraft'))) return true;
    if (i.state === 'ship' && softYes(can(who, 'shipGate'))) return true;
    if (i.state === 'submitted' && !i.needsCraft && softYes(can(who, 'shipGate'))) return true;
    if (i.state === 'client' && softYes(can(who, 'triageFeedback'))) return true;
    return false;
  };
  const team = (i) => (s.all ? true : (s.people || []).includes(i.assignee) || (s.people || []).includes(i.owner));

  if (tab === 'mine') return items.filter(mine);
  if (tab === 'tome') return items.filter(toMe);
  if (tab === 'team') return items.filter(team);
  if (tab === 'all') return s.all ? items : items.filter(team);
  return items.filter((i) => mine(i) || toMe(i));
}

export function tabsFor(who) {
  const s = scopeOf(who);
  const t = [['mine', 'Mine'], ['tome', 'Coming to me']];
  // Only offer a team tab to someone who actually has a team under them.
  const hasTeam = !s.all && (s.people || []).length > 1;
  if (hasTeam) t.push(['team', 'My team']);
  if (s.all) t.push(['all', 'All work']);
  else if (hasTeam) t.push(['all', 'Everything I can see']);
  return t;
}

export function isLate(i, today) {
  if (!i.due || ['approved', 'done'].includes(i.state)) return false;
  return i.due < (today || new Date().toISOString().slice(0, 10));
}
