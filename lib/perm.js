// Who is allowed to do what. Taken straight from the approved roles table.
// A value is either 'yes', 'no', or a shade: 'request', 'comment', 'exception',
// 'oversight', or a scoped sentence that describes the limit.
export const PERM = {
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
export const SCOPE = {
  himanshu: { all: true },
  aashif:   { all: true },
  priyanka: { team: ['priyanka','nayeem','intern'] },
  shelly:   { team: ['shelly','unnati','hd','freelancer'] },
};

export function can(who, key) {
  const m = PERM[key] || {};
  return m[who] || 'no';
}
export function allowed(who, key) {
  return can(who, key) !== 'no';
}
export function scopeOf(who) {
  const s = SCOPE[who];
  if (!s) return { people: [who], all: false };
  if (s.all) return { people: null, all: true };
  return { people: s.team, all: false };
}

const R_ALL = 'himanshu,aashif,priyanka,nayeem,shelly,unnati,hd,gowtham,intern';
export const NAV = [
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

export function navFor(who) {
  return NAV.map((g) => ({ g: g.g, items: g.items.filter((i) => i.roles.split(',').includes(who)) }))
            .filter((g) => g.items.length);
}
