// Puts the people, clients and projects into Sanity.
// Safe to run more than once: it never overwrites something that already exists.
import { loadEnv } from '../lib/env.mjs';
import { createClient } from '@sanity/client';

loadEnv();

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_API_TOKEN in .env.local');
  process.exit(1);
}

const sanity = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

const PEOPLE = [
  { slug: 'himanshu', name: 'Himanshu Arora', role: 'Founder', reportsTo: null },
  { slug: 'aashif',   name: 'Aashif',         role: 'Operations lead, ship gate', reportsTo: 'himanshu' },
  { slug: 'priyanka', name: 'Priyanka',       role: 'Brand content and client relationship', reportsTo: 'himanshu' },
  { slug: 'shelly',   name: 'Shelly',         role: 'Creative lead, craft gate', reportsTo: 'himanshu' },
  { slug: 'nayeem',   name: 'Nayeem',         role: 'Content', reportsTo: 'priyanka' },
  { slug: 'unnati',   name: 'Unnati',         role: 'Design', reportsTo: 'shelly' },
  { slug: 'hd',       name: 'HD',             role: 'Design, first time projects', reportsTo: 'shelly' },
  { slug: 'gowtham',  name: 'Gowtham',        role: 'SEO', reportsTo: 'aashif' },
];

const CLIENTS = [
  { slug: 'egc',     name: 'Elite Global Concierge', code: 'EGC',     driveEnv: 'DRIVE_FOLDER_EGC' },
  { slug: 'litg',    name: 'Liberty International Tourism Group', code: 'LITG', driveEnv: 'DRIVE_FOLDER_LITG',
    note: 'Contract ends 31 Dec 2026' },
  { slug: 'skydome', name: 'Skydome',               code: 'SKYDOME', driveEnv: 'DRIVE_FOLDER_SKYDOME' },
  { slug: 'stch',    name: 'STCH',                  code: 'STCH',    driveEnv: 'DRIVE_FOLDER_STCH' },
  { slug: 'jwc',     name: 'Jaipur Watch Company',  code: 'JWC',     driveEnv: null },
];

// Calendar sheets found on the shared drive. Editable in the portal afterwards.
const CAL = {
  egc: [
    { label: 'Main calendar',     sheetId: '1SfXLJHtWVeCZ26GNxorxZVl6FjudYOaTwZajXF_AE1s', year: 2026, current: true },
    { label: 'LinkedIn calendar', sheetId: '1iigVjjtwD5AzAjtda9yDuJqqg7J_yb6kauNEGU0s9YE', year: 2026, current: true },
  ],
  litg: [
    { label: '2026 calendar', sheetId: '1CQMbyAPxhiK-StE9XUZWYm8F3GlmwHcE6QCoF9cFCOE', year: 2026, current: true },
  ],
  stch: [
    { label: 'Calendar', sheetId: '1VMc8DzTU0YvPwKL-2InY_hk9JSn63yvrx1H3JrZzW5k', year: 2026, current: true },
  ],
  skydome: [
    { label: 'Calendar', sheetId: '1Quw75miUZf58StRjoRJ0LqTp3tmBrWAXm0OWJLszO0U', year: 2026, current: true },
  ],
};

const PROJECTS = [
  { slug: 'egc-website',     name: 'EGC website, Phase 1', client: 'egc',     type: 'website',    owner: 'aashif'   },
  { slug: 'egc-social',      name: 'EGC social retainer',  client: 'egc',     type: 'social',     owner: 'priyanka' },
  { slug: 'litg-social',     name: 'Liberty social retainer', client: 'litg', type: 'social',     owner: 'priyanka' },
  { slug: 'skydome-social',  name: 'Skydome social retainer', client: 'skydome', type: 'social',  owner: 'priyanka' },
  { slug: 'stch-social',     name: 'STCH social retainer', client: 'stch',    type: 'social',     owner: 'priyanka' },
  { slug: 'jwc-influencer',  name: 'JWC creator campaign', client: 'jwc',     type: 'influencer', owner: 'aashif'   },
];

const CADENCE = { social: 'weekly', website: 'milestone', seo: 'monthly', influencer: 'milestone', video: 'perAsset' };

const docs = [];

for (const p of PEOPLE) {
  docs.push({
    _id: 'person.' + p.slug, _type: 'person',
    slug: p.slug, name: p.name, role: p.role,
    reportsTo: p.reportsTo ? { _type: 'reference', _ref: 'person.' + p.reportsTo } : undefined,
    email: '', active: true,
  });
}

for (const c of CLIENTS) {
  docs.push({
    _id: 'client.' + c.slug, _type: 'client',
    slug: c.slug, name: c.name, code: c.code,
    driveFolderId: c.driveEnv ? (process.env[c.driveEnv] || '') : '',
    note: c.note || '', active: true,
  });
}

for (const pr of PROJECTS) {
  docs.push({
    _id: 'project.' + pr.slug, _type: 'project',
    slug: pr.slug, name: pr.name, type: pr.type,
    cadence: CADENCE[pr.type],
    client: { _type: 'reference', _ref: 'client.' + pr.client },
    owner: { _type: 'reference', _ref: 'person.' + pr.owner },
    status: 'active',
    calendarSources: (CAL[pr.client] && pr.type === 'social') ? CAL[pr.client].map((c, i) => ({ _key: 'cal' + i, ...c })) : [],
    deliverables: [],
  });
}

let tx = sanity.transaction();
for (const d of docs) tx = tx.createIfNotExists(d);
await tx.commit();

const counts = await sanity.fetch(
  '{"person":count(*[_type=="person"]),"client":count(*[_type=="client"]),"project":count(*[_type=="project"])}'
);
console.log('Done. Sanity now holds:');
console.log('  people   ', counts.person);
console.log('  clients  ', counts.client);
console.log('  projects ', counts.project);
console.log('\nNothing existing was overwritten. Edit names, owners and calendar links in the portal.');
