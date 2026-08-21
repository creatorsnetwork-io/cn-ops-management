import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { log } from '../../../lib/week';
import { leadOf, raiseEscalation } from '../../../lib/escalate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const CAN_RESOLVE = ['himanshu', 'aashif'];

export async function POST(req) {
  const who = meSlug();
  const body = await req.json();

  // Someone has to own it, otherwise it sits on the founder by default,
  // which is the exact habit this list exists to break.
  if (body.action === 'take' || body.action === 'give' || body.action === 'unassign') {
    if (!body.id) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });
    const now = new Date().toISOString();
    let slug = null;
    if (body.action === 'take') slug = who;
    if (body.action === 'give') {
      if (!CAN_RESOLVE.includes(who)) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can hand one of these to someone else.' }, { status: 403 });
      if (!body.slug) return Response.json({ ok: false, error: 'Pick who is taking it.' }, { status: 400 });
      slug = body.slug;
    }
    await sanity(true).patch(body.id).set({
      owner: slug ? { _type: 'reference', _ref: 'person.' + slug } : null,
      takenAt: slug ? now : null, takenBy: slug ? who : null,
    }).commit();
    await log(who, slug === who ? 'Picked up an escalation' : slug ? 'Handed an escalation to ' + slug : 'Left an escalation unowned', body.id, '');
    return Response.json({ ok: true, owner: slug });
  }

  if (body.action === 'resolve') {
    if (!body.id) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });
    const mine = await sanity(true).fetch('*[_id==$id][0]{"owner":owner->slug}', { id: body.id });
    if (!CAN_RESOLVE.includes(who) && (mine || {}).owner !== who)
      return Response.json({ ok: false, error: 'Only Himanshu, Aashif, or whoever owns this can close it.' }, { status: 403 });
    if (!String(body.resolution || '').trim())
      return Response.json({ ok: false, error: 'Say what happened. A closed escalation with no explanation is worse than an open one.' }, { status: 400 });
    const now = new Date().toISOString();
    await sanity(true).patch(body.id).set({
      resolvedAt: now, resolvedBy: who,
      resolution: String(body.resolution || '').slice(0, 1000),
      outcome: ['fixed', 'accepted', 'wont-fix'].includes(body.outcome) ? body.outcome : 'fixed',
    }).commit();
    await log(who, 'Closed an escalation', body.id, body.resolution || '');
    return Response.json({ ok: true });
  }

  // Anyone can raise one. It goes to their lead, not to the founder.
  if (body.action === 'raise') {
    if (!String(body.reason || '').trim())
      return Response.json({ ok: false, error: 'Say what decision you need. "Please help" is not a decision.' }, { status: 400 });
    const doc = await raiseEscalation({
      who, reason: body.reason, detail: body.detail,
      projectSlug: body.slug, workId: body.workId, kind: 'manual',
    });
    await log(who, 'Raised an escalation', doc._id, body.reason);
    const lead = await leadOf(who);
    return Response.json({ ok: true, id: doc._id, wentTo: lead || who });
  }

  // "I cannot decide this." Moves it one step up and records that it happened.
  if (body.action === 'passUp') {
    if (!body.id) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });
    if (!String(body.note || '').trim())
      return Response.json({ ok: false, error: 'Say why you cannot decide it. That is the whole value of passing it up.' }, { status: 400 });
    const e = await sanity(true).fetch('*[_id==$id][0]{_id,hops,resolvedAt,"owner":owner->slug}', { id: body.id });
    if (!e) return Response.json({ ok: false, error: 'That escalation no longer exists.' }, { status: 404 });
    if (e.resolvedAt) return Response.json({ ok: false, error: 'That one is already closed.' }, { status: 400 });
    if (e.owner !== who && !CAN_RESOLVE.includes(who))
      return Response.json({ ok: false, error: 'Only whoever holds this can pass it up.' }, { status: 403 });

    const up = await leadOf(e.owner || who);
    if (!up) return Response.json({ ok: false, error: 'This is already as high as it goes. It needs deciding, not moving.' }, { status: 400 });

    const now = new Date().toISOString();
    await sanity(true).patch(body.id).set({
      owner: { _type: 'reference', _ref: 'person.' + up },
      takenAt: now, takenBy: 'passed up',
      hops: (e.hops || []).concat([{ _key: 'h' + Date.now(), at: now, from: e.owner || who, to: up, note: String(body.note).slice(0, 600) }]),
    }).commit();
    await log(who, 'Passed an escalation up to ' + up, body.id, body.note);
    return Response.json({ ok: true, wentTo: up });
  }

  return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}

// Removing one raised in error. Only while it is still open and untouched, so a
// decision that actually travelled can never be quietly deleted.
export async function DELETE(req) {
  const who = meSlug();
  if (!CAN_RESOLVE.includes(who))
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can remove an escalation.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Which one.' }, { status: 400 });

  const e = await sanity(true).fetch('*[_id==$id][0]{_id,hops,resolvedAt}', { id });
  if (!e) return Response.json({ ok: false, error: 'Already gone.' }, { status: 404 });
  if (e.resolvedAt)
    return Response.json({ ok: false, error: 'That one is closed. Closed escalations are the record and stay.' }, { status: 400 });
  if ((e.hops || []).length > 1)
    return Response.json({ ok: false, error: 'That one has already been passed up, so it stays. Close it instead.' }, { status: 400 });

  await sanity(true).delete(id);
  await log(who, 'Removed an escalation raised in error', id, '');
  return Response.json({ ok: true });
}

// Read side, used by the home screen and the digest.
export async function GET(req) {
  const who = meSlug();
  const q = new URL(req.url).searchParams;
  const mine = q.get('mine') === '1';
  const rows = await sanity(true).fetch(
    `*[_type=="escalation" && !defined(resolvedAt)
        ${mine ? '&& (owner->slug == $who || raisedBy == $who)' : ''}]|order(at desc)[0...60]{
      _id, at, who, raisedBy, kind, reason, detail, hops, target,
      "owner": owner->slug, "ownerName": owner->name,
      "projectName": project->name, "projectSlug": project->slug}`,
    { who });
  return Response.json({ ok: true, rows, who, canResolve: CAN_RESOLVE.includes(who) });
}
