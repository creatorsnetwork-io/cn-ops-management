import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
];

// Finds the service account JSON the user dropped into the project folder.
// Accepts any *.json that looks like a Google key, so the filename does not matter.
export function findKeyFile() {
  const dir = process.cwd();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    if (f === 'package.json' || f === 'package-lock.json') continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (j.type === 'service_account' && j.private_key && j.client_email) {
        return { file: f, email: j.client_email, key: j.private_key };
      }
    } catch (e) { /* not json we care about */ }
  }
  return null;
}

export function creds() {
  const kf = findKeyFile();
  if (kf) return { email: kf.email, key: kf.key, source: 'file: ' + kf.file };
  const email = process.env.GOOGLE_SA_EMAIL;
  // Env vars are pasted by hand into a dashboard, so be forgiving of the two
  // ways that goes wrong: the surrounding quotes from the .env file coming
  // along for the ride, and escaped newlines that need turning back into
  // real ones. Either mistake makes the PEM unreadable and Node's crypto
  // layer fails with an opaque DECODER error, so we guard against both.
  let key = (process.env.GOOGLE_SA_PRIVATE_KEY || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))
    key = key.slice(1, -1);
  key = key.replace(/\\n/g, '\n');
  if (email && key) return { email, key, source: 'env variables' };
  return null;
}

export function auth() {
  const c = creds();
  if (!c) throw new Error('No Google credentials found. Drop the service account JSON into the project folder.');
  return new google.auth.JWT({ email: c.email, key: c.key, scopes: SCOPES });
}

export async function readSheet(sheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: range || 'A1:Z400' });
  return res.data.values || [];
}

// Pulls the link out of a cell whichever way it was put there.
// Google stores a link in four different places depending on how it was added,
// so all four are checked and we record which one worked.
export function cellOf(c) {
  const cell = c || {};
  const text = cell.formattedValue || '';
  if (cell.hyperlink) return { text, link: cell.hyperlink, how: 'cell link' };

  // Smart chips. This is how Drive files pasted into Sheets actually store their link.
  for (const r of cell.chipRuns || []) {
    const rl = r && r.chip && r.chip.richLinkProperties;
    if (rl && rl.uri) return { text, link: rl.uri, how: 'smart chip', mimeType: rl.mimeType || '' };
  }

  for (const r of cell.textFormatRuns || []) {
    const uri = r && r.format && r.format.link && r.format.link.uri;
    if (uri) return { text, link: uri, how: 'part of the text' };
  }

  const f = cell.userEnteredValue && cell.userEnteredValue.formulaValue;
  if (f) {
    const m = /HYPERLINK\s*\(\s*["']([^"']+)["']/i.exec(f);
    if (m) return { text, link: m[1], how: 'HYPERLINK formula' };
  }

  const inText = /https?:\/\/[^\s,]+/.exec(text);
  if (inText) return { text, link: inText[0], how: 'plain address' };

  return { text, link: '', how: '' };
}

// Reads a tab's grid including the link behind display text,
// because Post Link cells show a filename over a URL.
export async function readSheetWithLinks(sheetId, tabTitle) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  const res = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: true,
    ranges: tabTitle ? ["'" + String(tabTitle).replace(/'/g, "''") + "'"] : undefined,
    fields: 'sheets(properties(title),data(rowData(values(formattedValue,hyperlink,userEnteredValue,chipRuns(chip(richLinkProperties(uri,mimeType))),textFormatRuns(format(link(uri)))))))',
  });
  const sheet = (res.data.sheets || [])[0];
  const rows = (((sheet || {}).data || [])[0] || {}).rowData || [];
  return rows.map((r) => (r.values || []).map(cellOf));
}

export async function listSheetTabs(sheetId) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'properties(title),sheets(properties(title,gridProperties(rowCount)))' });
  return {
    title: res.data.properties.title,
    tabs: (res.data.sheets || []).map((s) => ({ title: s.properties.title, rows: s.properties.gridProperties.rowCount })),
  };
}

export async function listFolder(folderId) {
  const drive = google.drive({ version: 'v3', auth: auth() });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,modifiedTime)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

// Turn a zero based column index into a spreadsheet letter. 0 is A, 26 is AA.
export function colLetter(n) {
  let s = '';
  let i = Number(n);
  while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; }
  return s;
}

// Read one cell exactly as it stands, so a write can check before it acts.
export async function readCell(sheetId, tab, a1) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  const range = "'" + String(tab).replace(/'/g, "''") + "'!" + a1;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const v = ((res.data.values || [])[0] || [])[0];
  return v == null ? '' : String(v);
}

// Write one cell. The caller decides whether that is allowed, not this function.
export async function writeCell(sheetId, tab, a1, value) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  const range = "'" + String(tab).replace(/'/g, "''") + "'!" + a1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId, range, valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
  return { range };
}


// The link a smart chip or hyperlink carries is a viewing URL, not a plain file id.
// Pulls the id out of whichever shape Drive gives it.
export function driveFileId(link) {
  const m = String(link || '').match(/\/d\/([a-zA-Z0-9_-]+)/) || String(link || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Just the metadata, so a caller can decide what to do (or skip it) before
// spending anything on a download.
export async function driveFileMeta(fileId) {
  const drive = google.drive({ version: 'v3', auth: auth() });
  const res = await drive.files.get({ fileId, fields: 'id,name,mimeType,modifiedTime,size' });
  return res.data;
}

// The actual bytes. Used only for the image and PDF checks, never kept anywhere
// after the one check that needed them.
export async function downloadDriveFile(fileId) {
  const drive = google.drive({ version: 'v3', auth: auth() });
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}
