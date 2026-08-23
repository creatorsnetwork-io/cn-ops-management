// Can the portal follow the shortcuts in the Google Meet folder to the real notes?
// Run from the project root:  node scripts/checkshortcuts.mjs
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const MEET_FOLDER = '1GUkjB-Mpc0Dtep4IsRNLNv2gI6EHiFpS';

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
if (!k) { console.log('No service account JSON found. Run from the project root.'); process.exit(1); }

const auth = new google.auth.JWT({
  email: k.client_email, key: k.private_key,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

const subs = await drive.files.list({
  q: `'${MEET_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  fields: 'files(id,name)', orderBy: 'createdTime desc', pageSize: 15,
});

let docs = 0, ok = 0, blocked = 0;
for (const s of subs.data.files || []) {
  const kids = await drive.files.list({
    q: `'${s.id}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,shortcutDetails(targetId,targetMimeType),owners(emailAddress))',
    pageSize: 20,
  });
  for (const d of kids.data.files || []) {
    const isShortcut = d.mimeType === 'application/vnd.google-apps.shortcut';
    const targetId = isShortcut ? d.shortcutDetails?.targetId : d.id;
    const label = (isShortcut ? 'shortcut -> ' : 'direct    -> ') + d.name.slice(0, 60);
    if (!targetId) { console.log('  BROKEN   ' + label); blocked++; continue; }
    docs++;
    try {
      const meta = await drive.files.get({ fileId: targetId, fields: 'name,mimeType,owners(emailAddress)' });
      const out = await drive.files.export({ fileId: targetId, mimeType: 'text/plain' });
      const n = String(out.data || '').length;
      console.log('  READABLE ' + label);
      console.log('           owner ' + (meta.data.owners?.[0]?.emailAddress || 'unknown') + ', ' + n + ' characters');
      ok++;
    } catch (e) {
      console.log('  BLOCKED  ' + label);
      console.log('           ' + (e.errors?.[0]?.message || e.message).slice(0, 120));
      blocked++;
    }
  }
}
console.log('');
console.log('Notes found: ' + docs + '   readable: ' + ok + '   blocked: ' + blocked);
