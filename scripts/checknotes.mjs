// Can the portal's own Google identity see the Gemini meeting notes?
// Run from the project root:  node scripts/checknotes.mjs
// Reads the service account JSON already sitting in this folder. Prints no secrets.
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const MEET_FOLDER = '1GUkjB-Mpc0Dtep4IsRNLNv2gI6EHiFpS'; // My Drive > Google Meet

function keyFile() {
  for (const f of fs.readdirSync(process.cwd()).filter((x) => x.endsWith('.json'))) {
    if (f === 'package.json' || f === 'package-lock.json') continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), f), 'utf8'));
      if (j.type === 'service_account' && j.private_key && j.client_email) return j;
    } catch {}
  }
  return null;
}

const k = keyFile();
if (!k) { console.log('No service account JSON found in this folder. Run this from the project root.'); process.exit(1); }
console.log('Portal identity : ' + k.client_email);
console.log('');

const auth = new google.auth.JWT({
  email: k.client_email, key: k.private_key,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

try {
  const f = await drive.files.get({ fileId: MEET_FOLDER, fields: 'id,name,owners(emailAddress)' });
  console.log('CAN SEE the folder: "' + f.data.name + '"');
} catch (e) {
  console.log('CANNOT see the Google Meet folder.');
  console.log('Reason: ' + (e.errors?.[0]?.message || e.message));
  console.log('');
  console.log('The share did not reach this identity. Re-share the folder with the address above.');
  process.exit(0);
}

const subs = await drive.files.list({
  q: `'${MEET_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  fields: 'files(id,name)', orderBy: 'createdTime desc', pageSize: 10,
});
console.log('Meeting folders visible: ' + (subs.data.files || []).length);
console.log('');

for (const s of subs.data.files || []) {
  const docs = await drive.files.list({
    q: `'${s.id}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType)', pageSize: 20,
  });
  console.log('  ' + s.name);
  for (const d of docs.data.files || []) {
    const kind = d.mimeType === 'application/vnd.google-apps.document' ? 'doc' : d.mimeType.split('.').pop();
    console.log('      [' + kind + '] ' + d.name);
  }
}

const first = (subs.data.files || [])[0];
if (first) {
  const docs = await drive.files.list({
    q: `'${first.id}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: 'files(id,name)', pageSize: 1,
  });
  const doc = (docs.data.files || [])[0];
  if (doc) {
    const out = await drive.files.export({ fileId: doc.id, mimeType: 'text/plain' });
    const text = String(out.data || '');
    console.log('');
    console.log('Read test on: ' + doc.name);
    console.log('Characters returned: ' + text.length);
    console.log('First 300 characters:');
    console.log(text.slice(0, 300).replace(/\n{2,}/g, '\n'));
  }
}
