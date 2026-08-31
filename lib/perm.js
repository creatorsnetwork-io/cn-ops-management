// Who is allowed to do what. Used to live only in code as a hardcoded table;
// now it lives in Sanity (doc `access.config`) so access can change without a
// deploy. These defaults are the exact values the app shipped with before that,
// and they're the fallback if the config doc is missing or Sanity can't be
// reached, so a bad connection never locks everyone out of everything.
import { sanity } from './sanity';
import { cachedDoc, forgetDoc } from './sheetcache';

const ID = 'access.config';
const CACHE_KEY = 'access-config';
const TTL = 60 * 1000;

export const DEFAULT_PERM = {
  createClient:     { himanshu:'yes', aashif:'yes' },
  createProject:    { himanshu:'yes', aashif:'yes', priyanka:'request', nayeem:'request', gowtham:'request' },
  uploadContract:   { himanshu:'yes', aashif:'yes' },
  editPRD:          { himanshu:'yes', aashif:'yes', priyanka:'comment', nayeem:'comment', shelly:'comment', gowtham:'comment', unnati:'View assigned section', hd:'View assigned section' },
  editDeliverables: { himanshu:'yes', aashif:'yes', priyanka:'request', nayeem:'request', shelly:'request', gowtham:'request' },
  generate:         { himanshu:'yes', aashif:'yes', priyanka:'yes', nayeem:'yes', intern:'Draft only', shelly:'Creative only', unnati:'Assigned production', hd:'Assigned production', gowtham:'SEO content' },
  approveBrand:     { himanshu:'exception', aashif:'oversight', priyanka:'yes', gowtham:'SEO-specific' },
  // Accepting a meeting recap creates decision records against a client, so it is
  // an approval, not admin. Nayeem runs calls but cannot sign yet: change his value
  // to 'yes' when you want that.
  approveRecap:     { himanshu:'yes', aashif:'yes', priyanka:'yes', nayeem:'Assigned projects' },
  approveCraft:     { himanshu:'exception', aashif:'oversight', priyanka:'Brand alignment', shelly:'yes' },
  shipGate:         { himanshu:'yes', aashif:'yes', shelly:'Creative gate only', gowtham:'SEO submission' },
  // Sending a week with flags still open. Always writes an escalation naming who did it.
  shipOverride:     { himanshu:'yes', aashif:'yes', priyanka:'yes' },
  shareClientLink:  { himanshu:'yes', aashif:'yes', priyanka:'yes', nayeem:'yes' },
  triageFeedback:   { himanshu:'oversight', aashif:'yes', priyanka:'yes', nayeem:'Assigned projects', shelly:'Creative responses', unnati:'Assigned revisions', hd:'Assigned revisions', gowtham:'SEO responses' },
  editCalendarSources: { himanshu:'yes', aashif:'yes' },
  // Assigning is not the same as editing a brief. A lead can hand work to their
  // own people without being able to rewrite what the work is.
  createWork:       { himanshu:'yes', aashif:'yes', priyanka:'team', shelly:'team' },
  assignWork:       { himanshu:'yes', aashif:'yes', priyanka:'team', shelly:'team' },
  closeProject:     { himanshu:'yes', aashif:'yes' },
  settings:         { himanshu:'yes', aashif:'yes' },
};

// Whose work each person can see. Absent means only their own.
export const DEFAULT_SCOPE = {
  himanshu: { all: true },
  aashif:   { all: true },
  priyanka: { team: ['priyanka','nayeem','intern'] },
  shelly:   { team: ['shelly','unnati','hd','freelancer'] },
};

const R_ALL = 'himanshu,aashif,priyanka,nayeem,shelly,unnati,hd,gowtham,intern';
export const DEFAULT_NAV = [
  { g:'Workspace', items:[
    { href:'/',          l:'Home',     roles:R_ALL },
    { href:'/clients',   l:'Clients',  roles:'himanshu,aashif,priyanka,nayeem' },
    { href:'/projects',  l:'Projects', roles:'himanshu,aashif,priyanka,nayeem,shelly,unnati,hd,gowtham' },
    { href:'/work',      l:'Work',     roles:R_ALL } ] },
  { g:'Quality', items:[
    { href:'/calendar',  l:'Calendar tracker', roles:'himanshu,aashif,priyanka,nayeem' },
    { href:'/qc',        l:'QC flags',         roles:'himanshu,aashif,priyanka,nayeem,shelly,gowtham' },
    { href:'/feedback',  l:'Client feedback',  roles:'himanshu,aashif,priyanka,nayeem,shelly,unnati,hd' },
    { href:'/brand',     l:'Brand brain',      roles:'himanshu,aashif,priyanka,gowtham' } ] },
  { g:'Inbound', items:[
    { href:'/requests',  l:'Requests', roles:'himanshu,aashif,priyanka,nayeem' },
    { href:'/notes',     l:'Meeting notes', roles:'himanshu,aashif,priyanka,nayeem' } ] },
  { g:'Records', items:[
    { href:'/reports',   l:'Reports',      roles:'himanshu,aashif,priyanka,nayeem,gowtham' },
    { href:'/links',     l:'Client links', roles:'himanshu,aashif,priyanka,nayeem' },
    { href:'/archive',   l:'Archive',      roles:'himanshu,aashif,priyanka' } ] },
  { g:'Decisions', items:[
    { href:'/escalations', l:'Escalations', roles:'himanshu,aashif,priyanka,shelly,gowtham,nayeem,unnati,hd' } ] },
  { g:'Founder', items:[
    { href:'/pipeline',    l:'Pipeline',    roles:'himanshu' } ] },
  { g:'System', items:[
    { href:'/team',     l:'Team and capacity', roles:'himanshu,aashif,priyanka,shelly' },
    { href:'/vendors',  l:'Vendors and freelancers', roles:'himanshu,aashif,priyanka,shelly' },
    { href:'/jobs',     l:'Job health',        roles:'himanshu,aashif' },
    { href:'/settings', l:'Settings',          roles:'himanshu,aashif' },
    { href:'/setup',    l:'Connections',       roles:'himanshu,aashif' } ] },
];

async function loadConfig() {
  return cachedDoc(CACHE_KEY, TTL, async () => {
    try {
      const doc = await sanity(true).fetch('*[_id==$id][0]{perm,scope,nav}', { id: ID });
      if (doc && doc.perm) {
        return { perm: doc.perm, scope: doc.scope || DEFAULT_SCOPE, nav: doc.nav || DEFAULT_NAV };
      }
    } catch (e) {
      // Sanity unreachable or the doc doesn't exist yet: fall back rather than fail.
    }
    return { perm: DEFAULT_PERM, scope: DEFAULT_SCOPE, nav: DEFAULT_NAV };
  });
}

// Called after the access screen saves, so the next check reads the new values
// instead of whatever was cached for up to a minute.
export function forgetAccessConfig() { forgetDoc(CACHE_KEY); }

export async function can(who, key) {
  const { perm } = await loadConfig();
  const m = perm[key] || {};
  return m[who] || 'no';
}
export async function allowed(who, key) {
  return (await can(who, key)) !== 'no';
}
export async function scopeOf(who) {
  const { scope } = await loadConfig();
  const s = scope[who];
  if (!s) return { people: [who], all: false };
  if (s.all) return { people: null, all: true };
  return { people: s.team, all: false };
}

// The raw, unfiltered nav tree, for anything (like the access screen, or
// lib/guard's page check) that needs to reason about every role at once.
export async function navConfig() {
  const { nav } = await loadConfig();
  return nav;
}

export async function navFor(who) {
  const nav = await navConfig();
  return nav.map((g) => ({ g: g.g, items: g.items.filter((i) => i.roles.split(',').includes(who)) }))
            .filter((g) => g.items.length);
}

// The raw capability table, person shade by person shade. Editing lives on
// Team and capacity rather than a standalone screen, so this is what feeds
// that page's checkboxes.
export async function fullPermTable() {
  const { perm } = await loadConfig();
  return perm;
}

// Everything lib/work.js's checks need, resolved once. Lives here (not in
// lib/work.js) on purpose: this file pulls in Sanity, and lib/work.js is
// imported by client ('use client') components, which cannot bundle that
// chain for the browser. Server pages and API routes call this, then pass
// the plain result down as a prop; lib/work.js itself never imports can()
// or scopeOf() directly, so it stays safe for the browser bundle.
export async function workPerms(who) {
  const [approveCraft, shipGate, triageFeedback, assignWork, createWork, scope] = await Promise.all([
    can(who, 'approveCraft'), can(who, 'shipGate'), can(who, 'triageFeedback'),
    can(who, 'assignWork'), can(who, 'createWork'), scopeOf(who),
  ]);
  return { approveCraft, shipGate, triageFeedback, assignWork, createWork, scope };
}
