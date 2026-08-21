import fs from 'fs';
import path from 'path';

// Finds the OAuth client JSON dropped in the project folder, the same way the
// service account key is found. Nothing is ever pasted into a chat or a file.
export function oauthClient() {
  const dir = process.cwd();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    if (f === 'package.json' || f === 'package-lock.json') continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const w = j.web || j.installed;
      if (w && w.client_id) return { id: w.client_id, secret: w.client_secret || '', origins: w.javascript_origins || [], file: f };
    } catch (e) {}
  }
  if (process.env.GOOGLE_OAUTH_CLIENT_ID)
    return { id: process.env.GOOGLE_OAUTH_CLIENT_ID, secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '', origins: [], file: 'env' };
  return null;
}

export function allowedDomain() {
  return (process.env.AUTH_ALLOWED_DOMAIN || 'creatorsnetwork.io').replace(/^@/, '').trim();
}
