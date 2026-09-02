// Plain English copy for the user guide (app/(portal)/guide/page.js). Kept
// separate from lib/perm.js on purpose: perm.js is the source of truth for
// WHAT someone can do, this file is only the words used to describe that.
// A new nav href or permission key that has no entry here still renders,
// just with a generic line, instead of breaking the page.

export const NAV_BLURBS = {
  '/': 'Your own dashboard: what is yours to do, what is coming to you, and the daily digest.',
  '/clients': 'The list of clients CN works with, their brand brain, contract and contacts.',
  '/projects': 'Individual engagements under a client: the brief, deliverables, status and closure.',
  '/work': 'Day to day tasks: create them, assign them, track them through to done.',
  '/calendar': "The live content calendar, read straight from each project's Google Sheet.",
  '/qc': 'Quality flags on captions and creative, raised automatically. Advisory only, it never blocks a gate on its own.',
  '/feedback': 'Client change requests, waiting on a decision about what happens next.',
  '/brand': "Each client's brand brain: positioning, voice, what to never say, what to always include.",
  '/requests': 'Unplanned asks logged as they come in, waiting on a yes or no.',
  '/notes': 'Meeting notes and recaps, and the decisions that come out of them.',
  '/reports': 'Monthly report records, and when a shared link was last opened.',
  '/links': 'Every client and freelancer link that has been shared, and its open history.',
  '/archive': 'Closed projects, why they closed, and their final numbers.',
  '/escalations': 'Open decisions and blockers, routed to whoever owns them.',
  '/pipeline': "The founder's own business development pipeline.",
  '/team': 'Who is on the team, their workload, and their access, editable straight from here.',
  '/vendors': 'The roster of outside vendors and freelancers CN works with.',
  '/jobs': 'System health: what is running, what last succeeded, what needs a manual nudge.',
  '/settings': 'House rules, banned phrases, channel limits and the digest hour.',
  '/setup': 'Connection status for Google, Sanity and the AI drafting tools.',
  '/mobile': 'The three phone-first screens: log a request, your queue, feedback triage.',
};

// Order matters here, it is the display order on the guide page. Grouped
// roughly by where in a normal week each one comes up.
export const PERM_ORDER = [
  { key: 'createClient', label: 'Add new clients', blurb: 'Bring a brand new client into the system.' },
  { key: 'createProject', label: 'Start new projects', blurb: 'Open a new project under an existing client.' },
  { key: 'uploadContract', label: 'Upload contracts', blurb: "Attach a client's signed contract and its acceptance criteria to a project." },
  { key: 'editPRD', label: 'Edit the brief', blurb: "Write or change a project's requirements and acceptance criteria." },
  { key: 'editDeliverables', label: 'Edit deliverable targets', blurb: 'Set or change what a project is meant to produce, and by when.' },
  { key: 'generate', label: 'Draft with AI', blurb: 'Use the built in drafting tools for captions, briefs and week plans.' },
  { key: 'approveBrand', label: 'Approve brand brain', blurb: "Sign off a client's positioning and voice once it is written or updated." },
  { key: 'approveRecap', label: 'Approve meeting recaps', blurb: 'Confirm a meeting note is accurate before it becomes a decision on record.' },
  { key: 'approveCraft', label: 'Approve creative', blurb: 'Sign off creative work before it goes to the client.' },
  { key: 'shipGate', label: 'Ship to the client', blurb: 'Send an approved week or deliverable out.' },
  { key: 'shipOverride', label: 'Send with flags open', blurb: 'Ship something even though a quality flag has not been cleared. Always logged as an escalation.' },
  { key: 'shareClientLink', label: 'Share client links', blurb: "Create or send a client's no-login calendar link." },
  { key: 'triageFeedback', label: 'Triage client feedback', blurb: 'Decide what happens next when a client asks for a change.' },
  { key: 'editCalendarSources', label: 'Edit calendar sources', blurb: "Connect or change which Google Sheet a project's calendar reads from." },
  { key: 'createWork', label: 'Create work items', blurb: 'Add a new task.' },
  { key: 'assignWork', label: 'Assign work', blurb: 'Hand a task to someone on your team.' },
  { key: 'closeProject', label: 'Close projects', blurb: 'Mark a project finished and move it to the archive.' },
  { key: 'settings', label: 'House settings', blurb: 'Change house rules, banned phrases and system wide options.' },
];

// The standard shorthand values the Team page writes. Anything else typed
// there (like "Creative only" or "Assigned production") is already plain
// English someone wrote on purpose, so it is shown as-is instead of forced
// through this map.
const LEVELS = {
  yes: { tag: 'ok', label: 'Full access', say: 'You can do this yourself.' },
  request: { tag: 'warn', label: 'By request', say: 'You can request it. Someone with full access has to complete it.' },
  oversight: { tag: 'tl', label: 'Oversight', say: 'You can see it and step in, but day to day sign off is not yours.' },
  exception: { tag: 'mute', label: 'Exceptions only', say: 'This is delegated day to day. You only step in for exceptions.' },
  team: { tag: 'info', label: 'Your team', say: 'You can do this for your own team.' },
  comment: { tag: 'info', label: 'Comment only', say: 'You can comment on it, not edit it directly.' },
};

// Returns null for "no access", so callers can filter it out of a list of
// things someone CAN do, rather than listing everything they cannot.
export function describeLevel(rawValue) {
  const v = String(rawValue || '').trim();
  if (!v || v.toLowerCase() === 'no') return null;
  const known = LEVELS[v.toLowerCase()];
  if (known) return known;
  return { tag: 'tl', label: v, say: 'Scoped to: ' + v + '.' };
}
