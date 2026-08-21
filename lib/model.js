// The shape of everything stored in Sanity.
// Sanity does not need these declared up front, it stores whatever we send.
// This file exists so there is one place that says what a document looks like.

export const TYPES = {
  person: 'person',
  client: 'client',
  project: 'project',
  work: 'work',        // one piece of work: a post, a page, a film, a report
  request: 'request',  // unplanned client ask
  escalation: 'escalation',
  vendor: 'vendor',
  activity: 'activity',   // append only log
  snapshot: 'snapshot',   // what the client saw when they approved
};

// project.type -> how it is tracked
export const CADENCE = {
  social: 'weekly',
  website: 'milestone',
  seo: 'monthly',
  influencer: 'milestone',
  video: 'perAsset',
  aiVideo: 'perAsset',
  events: 'milestone',
};

// work.state, in order
export const WORK_STATES = [
  'briefed', 'progress', 'submitted', 'ship', 'craft', 'client', 'approved', 'done',
];

export const WORK_STATE_LABEL = {
  briefed: 'Briefed',
  progress: 'In progress',
  submitted: 'Submitted',
  ship: 'At ship gate',
  craft: 'At craft gate',
  client: 'With client',
  approved: 'Client approved',
  done: 'Done',
};

// A project carries its own list of calendar sheets, editable in the portal.
// { label, sheetId, year, current }
export const CALENDAR_SOURCE = ['label', 'sheetId', 'year', 'current'];

// A deliverable baseline is what the contract promised.
// { name, target, submitted, approved, acceptance }
// submitted and approved only move when a verb fires, never by hand.
export const DELIVERABLE = ['name', 'target', 'submitted', 'approved', 'acceptance'];
