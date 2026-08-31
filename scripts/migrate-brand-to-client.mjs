// One-off: the first version of the brand brain saved fields onto the PROJECT
// doc. It now lives on the CLIENT doc, shared across all of that client's
// projects. This moves anything already saved the old way onto the client,
// and only where that is safe to do without guessing.
//
// Safe to run more than once. It never overwrites a client field that already
// has something in it: if the client already has its own brand data, the
// project's copy is left exactly where it is and printed out so a person can
// look at both and decide by hand.
//
// Run from the project root:  node scripts/migrate-brand-to-client.mjs
import { loadEnv } from '../lib/env.mjs';
import { createClient } from '@sanity/client';

loadEnv();

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;
if (!projectId || !token) { console.error('Missing SANITY_PROJECT_ID or SANITY_API_TOKEN in .env.local'); process.exit(1); }

const sanity = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

const hasAny = (b) => !!(b && (String(b.positioning || '').trim() || String(b.visual || '').trim()
  || (b.voiceIs || []).length || (b.voiceIsNot || []).length
  || (b.neverSay || []).length || (b.always || []).length));

const rows = await sanity.fetch(`*[_type=="project" && defined(brand)]{
  _id, slug, name, brand, "clientSlug": client->slug, "clientName": client->name
}`);

if (!rows.length) { console.log('Nothing to move. No project has brand data on it.'); process.exit(0); }

console.log('Found ' + rows.length + ' project(s) with brand data saved the old way.\n');

let moved = 0, skippedNoClient = 0, skippedConflict = 0;

for (const p of rows) {
  if (!hasAny(p.brand)) { console.log('- ' + p.name + ': brand field exists but is empty, leaving as is.'); continue; }
  if (!p.clientSlug) {
    console.log('- ' + p.name + ': has brand data but is not linked to a client. Skipped, needs a person to look at it.');
    skippedNoClient++; continue;
  }
  const clientId = 'client.' + p.clientSlug;
  const existing = await sanity.fetch('*[_id==$id][0]{brand}', { id: clientId });
  if (existing && hasAny(existing.brand)) {
    console.log('- ' + p.name + ' (client ' + p.clientName + '): the client already has its own brand data. '
      + 'Left the project\'s copy in place, project id ' + p._id + ', so nothing is lost. Compare by hand and clear it once you have.');
    skippedConflict++; continue;
  }
  await sanity.patch(clientId).set({ brand: p.brand }).commit();
  await sanity.patch(p._id).unset(['brand']).commit();
  console.log('- ' + p.name + ' -> moved onto client ' + p.clientName + '.');
  moved++;
}

console.log('\n' + moved + ' moved, ' + skippedConflict + ' left in place due to a conflict, ' + skippedNoClient + ' had no client to move to.');
