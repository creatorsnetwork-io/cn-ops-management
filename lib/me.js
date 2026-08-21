import { cookies } from 'next/headers';
import { sanity } from './sanity';
import { currentSession } from './session';

export const DEFAULT_ME = 'himanshu';

// A real signed session wins. The old Testing as cookie only works locally,
// and only until sign in is switched on for good.
export function meSlug() {
  const s = currentSession();
  if (s && s.slug) return s.slug;
  if (process.env.NODE_ENV !== 'production') {
    return cookies().get('cn_me')?.value || DEFAULT_ME;
  }
  return null;
}

export function signedIn() {
  const s = currentSession();
  return s && s.slug ? s : null;
}

export async function people() {
  return sanity(true).fetch(
    '*[_type=="person" && active==true]|order(name asc){slug,name,role,email,"reportsTo":reportsTo->slug}'
  );
}

export async function me() {
  const slug = meSlug();
  const all = await people();
  const s = currentSession();
  return {
    slug,
    all,
    person: all.find((p) => p.slug === slug) || { slug, name: slug, role: '' },
    how: s ? s.how : 'testing',
  };
}
