import { OAuth2Client } from 'google-auth-library';
import { sanity } from '../../../lib/sanity';
import { oauthClient, allowedDomain } from '../../../lib/oauth';
import { sessionCookie, clearCookie } from '../../../lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const c = oauthClient();
  return Response.json({
    ok: true,
    clientId: c ? c.id : null,
    domain: allowedDomain(),
    originsRegistered: c ? c.origins : [],
    allowLocalBypass: process.env.NODE_ENV !== 'production',
  });
}

export async function POST(req) {
  const b = await req.json();

  if (b.action === 'signout') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json', 'set-cookie': clearCookie() },
    });
  }

  // Local only, and only for people already on the team list. This keeps the
  // portal usable before the localhost origin is authorised with Google.
  if (b.action === 'local') {
    if (process.env.NODE_ENV === 'production')
      return Response.json({ ok: false, error: 'Not available.' }, { status: 404 });
    const p = await sanity(true).fetch('*[_type=="person" && slug==$s && active==true][0]{slug,name}', { s: b.slug });
    if (!p) return Response.json({ ok: false, error: 'Nobody active with that name.' }, { status: 400 });
    return new Response(JSON.stringify({ ok: true, person: p }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': sessionCookie({ slug: p.slug, name: p.name, how: 'local', exp: Date.now() + 2592000000 }),
      },
    });
  }

  if (b.action === 'google') {
    const c = oauthClient();
    if (!c) return Response.json({ ok: false, error: 'No Google sign in client found in the project folder.' }, { status: 500 });
    if (!b.credential) return Response.json({ ok: false, error: 'Google sent nothing back.' }, { status: 400 });

    let payload;
    try {
      const client = new OAuth2Client(c.id);
      const ticket = await client.verifyIdToken({ idToken: b.credential, audience: c.id });
      payload = ticket.getPayload();
    } catch (e) {
      return Response.json({ ok: false, error: 'Google would not confirm that sign in. Try again.' }, { status: 401 });
    }

    const email = String(payload.email || '').toLowerCase();
    const domain = allowedDomain().toLowerCase();
    if (!payload.email_verified || !email.endsWith('@' + domain))
      return Response.json({ ok: false, error: 'This portal only accepts ' + domain + ' addresses. You signed in as ' + (email || 'an unknown account') + '.' }, { status: 403 });

    let p = await sanity(true).fetch('*[_type=="person" && lower(email)==$e && active==true][0]{slug,name}', { e: email });
    if (!p) {
      const first = email.split('@')[0].split(/[._-]/)[0];
      p = await sanity(true).fetch('*[_type=="person" && active==true && lower(slug)==$f][0]{slug,name}', { f: first });
      if (p) await sanity(true).patch('person.' + p.slug).set({ email }).commit();
    }
    if (!p)
      return Response.json({ ok: false, error: 'That address is not on the team list yet. Ask Himanshu or Aashif to add ' + email + ' on the Team screen.' }, { status: 403 });

    return new Response(JSON.stringify({ ok: true, person: p }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': sessionCookie({ slug: p.slug, name: p.name, email, how: 'google', exp: Date.now() + 2592000000 }),
      },
    });
  }

  return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
