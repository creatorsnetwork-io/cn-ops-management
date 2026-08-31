import { sanity } from '../../../../lib/sanity';
import { readProjectWeek, fingerprint } from '../../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

async function findReview(token) {
  return sanity(true).fetch(
    `*[_type=="weekReview" && clientToken==$t][0]{_id,projectSlug,week,shipGate,clientDecisions,firstOpenedAt,lastOpenedAt,
      "project":project->{name,"client":client->name,"clientLogo":client->logoUrl}}`, { t: token });
}

// Only what a client should see. No internal notes, no flags, no gate names.
function publicItem(i, decision) {
  return {
    key: i.key, date: i.date, type: i.type, title: i.title,
    channel: i.channel || (i.channels || []).join(', ') || '',
    captions: (i.captions || []).filter((c) => c.has).map((c) => ({ channel: c.channel, text: c.text })),
    creativeText: i.creativeText, creativeLink: i.creativeLink,
    decision: decision ? { decision: decision.decision, comment: decision.comment, at: decision.at, by: decision.by } : null,
  };
}

export async function GET(req, { params }) {
  const r = await findReview(params.token);
  if (!r) return Response.json({ ok: false, error: 'This link is not valid. Ask your contact at Creators Network for a new one.' }, { status: 404 });
  if (!r.shipGate) return Response.json({ ok: false, error: 'This week is not ready for review yet.' }, { status: 403 });

  const w = await readProjectWeek(r.projectSlug, r.week);
  if (w.error) return Response.json({ ok: false, error: 'We could not load this week. Please tell your contact at Creators Network.' });

  const byKey = {};
  for (const d of r.clientDecisions || []) byKey[d.key] = d;

  // First and last open, nothing per-open. A visit to the public side is the only honest signal.
  const now = new Date().toISOString();
  await sanity(true).patch(r._id).set({ lastOpenedAt: now, firstOpenedAt: r.firstOpenedAt || now }).commit();

  return Response.json({
    ok: true, client: r.project?.client, clientLogo: r.project?.clientLogo || '', project: r.project?.name, week: r.week,
    items: w.items.map((i) => publicItem(i, byKey[i.key])),
  });
}

export async function POST(req, { params }) {
  const body = await req.json();
  const r = await findReview(params.token);
  if (!r) return Response.json({ ok: false, error: 'This link is not valid.' }, { status: 404 });
  if (!r.shipGate) return Response.json({ ok: false, error: 'This week is not open for review.' }, { status: 403 });

  const decision = body.decision === 'changes' ? 'changes' : 'approved';
  const key = String(body.key || '');
  if (!key) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });

  const w = await readProjectWeek(r.projectSlug, r.week);
  if (w.error) return Response.json({ ok: false, error: 'We could not load this week.' });
  const item = w.items.find((x) => x.key === key);
  if (!item) return Response.json({ ok: false, error: 'That post is no longer in the calendar.' }, { status: 400 });

  const now = new Date().toISOString();
  const by = String(body.by || '').slice(0, 80) || 'Client';
  const comment = String(body.comment || '').slice(0, 2000);
  const c = sanity(true);

  const existing = (r.clientDecisions || []).filter((d) => d.key !== key);
  existing.push({ _key: key.replace(/[^A-Za-z0-9]/g, '_'), key, decision, comment, by, at: now });
  await c.patch(r._id).set({ clientDecisions: existing }).commit();

  // The record of exactly what was on screen when they decided.
  await c.create({
    _type: 'snapshot', at: now, by, decision, comment,
    review: { _type: 'reference', _ref: r._id, _weak: true },
    itemKey: key, week: r.week, projectSlug: r.projectSlug,
    fingerprint: fingerprint(item),
    seen: {
      date: item.date || '', type: item.type || '', title: item.title || '',
      creative: item.creativeLink || item.creativeText || '',
      captions: (item.captions || []).filter((x) => x.has).map((x) => x.channel + ': ' + x.text).join('\n\n---\n\n'),
    },
  });

  await c.create({
    _type: 'activity', at: now, who: 'client:' + by,
    what: decision === 'approved' ? 'Client approved a post' : 'Client asked for changes',
    target: r._id, detail: key + (comment ? ' — ' + comment : ''),
  });

  return Response.json({ ok: true, key, decision, by, at: now, comment });
}
