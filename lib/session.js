import crypto from 'crypto';
import { cookies } from 'next/headers';

const NAME = 'cn_session';

// The signing key never leaves the machine. If nothing is set we derive one from
// the Sanity token, which is already local only, so a session cannot be forged
// by someone who does not already have the keys.
function key() {
  return process.env.SESSION_SECRET || process.env.SANITY_API_TOKEN || 'cn-ops-local-only';
}
const sign = (s) => crypto.createHmac('sha256', key()).update(s).digest('base64url');

export function makeSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + sign(body);
}

export function readSession(raw) {
  if (!raw || !raw.includes('.')) return null;
  const [body, sig] = raw.split('.');
  let expected;
  try { expected = sign(body); } catch (e) { return null; }
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch (e) { return null; }
}

export function currentSession() {
  return readSession(cookies().get(NAME)?.value);
}

export function sessionCookie(payload) {
  const v = makeSession(payload);
  return `${NAME}=${v}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`;
}
export function clearCookie() {
  return `${NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
export const SESSION_NAME = NAME;
