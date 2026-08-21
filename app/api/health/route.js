import { ping } from '../../../lib/sanity';
import { creds, listSheetTabs, listFolder } from '../../../lib/google';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function check(name, fn) {
  try { const detail = await fn(); return { name, ok: true, detail }; }
  catch (e) { return { name, ok: false, error: humanise(e) }; }
}

function humanise(e) {
  const m = (e && e.message) || String(e);
  if (m.includes('has not been used') || m.includes('is disabled')) return 'That Google API is not switched on for this Cloud project. ' + m.slice(0, 160);
  if (m.includes('The caller does not have permission') || m.includes('403')) return 'The service account cannot see this file. Share it with the service account email, the same way you would share with a colleague.';
  if (m.includes('Requested entity was not found') || m.includes('404')) return 'That ID does not exist, or the service account cannot see it at all.';
  if (m.includes('Unauthorized') || m.includes('401')) return 'The token or key was rejected. It is wrong, expired, or for a different project.';
  if (m.includes('invalid_grant')) return 'The private key is malformed. If you pasted it into the env file, use the JSON file instead.';
  if (m.includes('ENOTFOUND') || m.includes('fetch failed')) return 'No network reply. Check the internet connection.';
  return m.slice(0, 240);
}

export async function GET() {
  const out = [];

  out.push(await check('Sanity, can we read and write', async () => {
    if (!process.env.SANITY_PROJECT_ID) throw new Error('SANITY_PROJECT_ID is missing from .env.local');
    if (!process.env.SANITY_API_TOKEN) throw new Error('SANITY_API_TOKEN is missing from .env.local');
    const r = await ping();
    return 'Connected to project ' + process.env.SANITY_PROJECT_ID + ', dataset ' + (process.env.SANITY_DATASET || 'production') + ', ' + r.docs + ' documents so far';
  }));

  out.push(await check('Google, do we have a key at all', async () => {
    const c = creds();
    if (!c) throw new Error('No service account key found. Drop the JSON file you downloaded into this folder.');
    return 'Using ' + c.source + ' for ' + c.email;
  }));

  const sheets = [
    ['EGC main calendar', '1SfXLJHtWVeCZ26GNxorxZVl6FjudYOaTwZajXF_AE1s'],
    ['EGC LinkedIn calendar', '1iigVjjtwD5AzAjtda9yDuJqqg7J_yb6kauNEGU0s9YE'],
    ['Liberty 2026 calendar', '1CQMbyAPxhiK-StE9XUZWYm8F3GlmwHcE6QCoF9cFCOE'],
    ['STCH calendar', '1VMc8DzTU0YvPwKL-2InY_hk9JSn63yvrx1H3JrZzW5k'],
    ['Skydome calendar', '1Quw75miUZf58StRjoRJ0LqTp3tmBrWAXm0OWJLszO0U'],
  ];
  for (const [label, id] of sheets) {
    out.push(await check('Sheet, ' + label, async () => {
      const r = await listSheetTabs(id);
      return '"' + r.title + '" with ' + r.tabs.length + ' tab' + (r.tabs.length === 1 ? '' : 's') + ': ' + r.tabs.map((t) => t.title).join(', ');
    }));
  }

  const folders = [
    ['EGC', process.env.DRIVE_FOLDER_EGC],
    ['Liberty', process.env.DRIVE_FOLDER_LITG],
    ['STCH', process.env.DRIVE_FOLDER_STCH],
    ['Skydome', process.env.DRIVE_FOLDER_SKYDOME],
  ];
  for (const [label, id] of folders) {
    out.push(await check('Drive folder, ' + label, async () => {
      if (!id) throw new Error('No folder ID set for ' + label + ' in .env.local');
      const f = await listFolder(id);
      return f.length + ' items visible, for example ' + (f.slice(0, 3).map((x) => x.name).join(', ') || 'the folder is empty');
    }));
  }

  out.push(await check('OpenAI key', async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing from .env.local');
    const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY } });
    if (!r.ok) throw new Error('OpenAI replied ' + r.status + '. The key is wrong, expired, or has no credit.');
    const j = await r.json();
    return 'Key works. ' + (j.data ? j.data.length : 0) + ' models available.';
  }));

  return Response.json({ checks: out, ok: out.every((c) => c.ok) });
}
