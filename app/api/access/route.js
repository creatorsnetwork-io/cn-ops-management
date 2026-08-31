import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can, fullPermTable, forgetAccessConfig, DEFAULT_PERM, DEFAULT_SCOPE, DEFAULT_NAV } from '../../../lib/perm';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ID = 'access.config';

// First real read or write seeds the Sanity doc with exactly the values the
// app shipped with, so nothing changes for anyone the moment this exists.
async function ensureDoc() {
  await sanity(true).createIfNotExists({ _id: ID, _type: 'access', perm: DEFAULT_PERM, scope: DEFAULT_SCOPE, nav: DEFAULT_NAV });
}

// Access lives on Team and capacity, not its own screen, so this only ever
// serves that page: the current capability table plus the people to show it
// against. Anyone signed in can read it (the page itself hides the checkboxes
// from anyone who cannot edit); only Settings can write it.
export async function GET() {
  try {
    await ensureDoc();
    const [perm, people] = await Promise.all([
      fullPermTable(),
      sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'),
    ]);
    return Response.json({ ok: true, perm, people });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}

export async function POST(req) {
  const who = meSlug();
  if ((await can(who, 'settings')) !== 'yes')
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change access.' }, { status: 403 });

  const { person, cap, value } = await req.json();
  if (!person || !cap) return Response.json({ ok: false, error: 'Missing person or right.' }, { status: 400 });

  try {
    await ensureDoc();
    const path = `perm.${cap}.${person}`;
    if (!value || value === 'no') {
      await sanity(true).patch(ID).unset([path]).commit();
    } else {
      await sanity(true).patch(ID).set({ [path]: String(value).slice(0, 60) }).commit();
    }
    forgetAccessConfig();
    await log(who, 'Changed access', ID, person + ': ' + cap + ' -> ' + (value || 'no'));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
