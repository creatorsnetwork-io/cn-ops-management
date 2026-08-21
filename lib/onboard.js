// Nine steps, from the prototype. The difference here: most of them are worked
// out from what actually exists rather than ticked by hand, because a checklist
// somebody has to remember to update is a checklist that lies.
export const STEPS = [
  'Client record created',
  'Client logo uploaded',
  'Brand brain written and signed off',
  'Approvers and channel agreed',
  'Drive folder and calendar created',
  'Contract uploaded and baseline approved',
  'PRD, where required',
  'First brief written',
  'Team assigned and gates named',
];

export const UNLOCKS = {
  1: 'A co-branded client link',
  2: 'Drafting, and the tone read',
  3: 'Client approvals can be recorded against a named person',
  4: 'Calendar tracker and writing back to the sheet',
  5: 'Deliverable counting and out-of-scope flags',
  6: 'Handing work to a freelancer',
  7: 'Work items and the handoff chain',
  8: 'Gate sign off',
};

// Which of the nine can be proven from data, and which need a human to say so.
export const DERIVED = [0, 1, 3, 4, 5, 6, 7, 8];
export const BY_HAND = [2];

export function evaluate(c) {
  const projects = c.projects || [];
  const social = projects.filter((p) => p.type === 'social');
  const needsPrd = projects.some((p) => ['website', 'influencer', 'events'].includes(p.type));

  const derived = [
    true,
    !!c.logoUrl,
    projects.some((p) => p.voice && p.voice.trim()),
    (c.contacts || []).some((x) => x.canApprove),
    !!c.driveFolderId && (social.length === 0 || social.every((p) => p.cals > 0)),
    projects.some((p) => p.contract) && projects.some((p) => (p.deliverables || []).length),
    !needsPrd || projects.some((p) => p.prd && p.prd.trim()),
    (c.briefs || 0) > 0,
    projects.length > 0 && projects.every((p) => p.owner),
  ];

  const manual = c.onbManual || {};
  const done = derived.map((d, i) => d || !!manual[String(i)]);

  const why = [
    'The record exists.',
    c.logoUrl ? 'Uploaded.' : 'No logo, so their review link is not co-branded.',
    derived[2] ? 'A voice note is written.' : 'No voice written, so drafts come back deliberately plain.',
    derived[3] ? (c.contacts || []).filter((x) => x.canApprove).length + ' approver(s) named.' : 'Nobody is marked as able to approve, so "the client said yes" has no name against it.',
    derived[4] ? 'Drive folder linked and every calendar attached.' : (!c.driveFolderId ? 'No Drive folder linked.' : 'A social project has no calendar attached.'),
    derived[5] ? 'Contract read and a baseline set.' : 'No contract or no baseline, so nothing can be counted against what was promised.',
    !needsPrd ? 'Not required for this client.' : (derived[6] ? 'Written.' : 'A website or campaign project has no working document.'),
    derived[7] ? 'At least one brief exists.' : 'No brief written yet.',
    derived[8] ? 'Every project has an owner.' : (projects.length ? 'A project has no owner.' : 'No projects yet.'),
  ];

  return { steps: STEPS, unlocks: UNLOCKS, derived, manual, done, why, count: done.filter(Boolean).length, byHand: BY_HAND };
}
