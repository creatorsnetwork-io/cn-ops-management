import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// One component, three payloads. The client weekly review is the third, and it
// lives on the weekReview because it belongs to a week rather than a work item.
const KINDS = ['brief', 'callsheet'];

export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (b.action === 'create') {
      if ((await can(who, 'shareClientLink')) === 'no' && !['himanshu', 'aashif'].includes(who))
        return Response.json({ ok: false, error: 'Your role does not share links outside the team.' }, { status: 403 });
      if (!KINDS.includes(b.kind)) return Response.json({ ok: false, error: 'Not a kind of link.' }, { status: 400 });

      const w = await sanity(true).fetch(
        '*[_id==$id][0]{_id,title,brief,acceptance,driveLink,due,callSheet,"projectSlug":project->slug}', { id: b.workId });
      if (!w) return Response.json({ ok: false, error: 'That work item no longer exists.' }, { status: 404 });

      if (b.kind === 'brief' && !String(w.brief || '').trim())
        return Response.json({ ok: false, error: 'There is no brief written yet. Sending an empty brief is how rework starts.' });
      if (b.kind === 'callsheet' && !(w.callSheet && w.callSheet.date))
        return Response.json({ ok: false, error: 'Fill in the call sheet first. A call sheet with no date and no location is not a call sheet.' });

      const existing = await sanity(true).fetch(
        '*[_type=="share" && workId==$w && kind==$k && revoked != true][0]{_id,token}', { w: b.workId, k: b.kind });
      if (existing) return Response.json({ ok: true, token: existing.token, reused: true });

      const token = (globalThis.crypto.randomUUID().replace(/-/g, '') + globalThis.crypto.randomUUID().replace(/-/g, '')).slice(0, 24);
      await c.create({
        _type: 'share', token, kind: b.kind, at: now, by: who,
        workId: b.workId, projectSlug: w.projectSlug,
        work: { _type: 'reference', _ref: b.workId, _weak: true },
        note: String(b.note || '').slice(0, 600),
        responses: [],
      });
      await log(who, 'Shared a ' + (b.kind === 'brief' ? 'job brief' : 'call sheet'), b.workId, '');
      return Response.json({ ok: true, token });
    }

    if (b.action === 'revoke') {
      if ((await can(who, 'shareClientLink')) === 'no' && !['himanshu', 'aashif'].includes(who))
        return Response.json({ ok: false, error: 'Your role cannot revoke links.' }, { status: 403 });
      const s = await sanity(true).fetch('*[_type=="share" && token==$t][0]{_id}', { t: b.token });
      if (!s) return Response.json({ ok: false, error: 'No such link.' }, { status: 404 });
      await c.patch(s._id).set({ revoked: true, revokedBy: who, revokedAt: now }).commit();
      await log(who, 'Revoked a shared link', b.token, '');
      return Response.json({ ok: true });
    }

    // The call sheet itself lives on the work item.
    if (b.action === 'callsheet') {
      const cs = b.callSheet || {};
      await c.patch(b.workId).set({
        callSheet: {
          date: cs.date || null,
          callTime: String(cs.callTime || '').slice(0, 40),
          wrapTime: String(cs.wrapTime || '').slice(0, 40),
          location: String(cs.location || '').slice(0, 300),
          mapLink: String(cs.mapLink || '').slice(0, 400),
          contacts: (cs.contacts || []).slice(0, 12).map((x, i) => ({
            _key: 'c' + i, name: String(x.name || '').slice(0, 80),
            role: String(x.role || '').slice(0, 80), phone: String(x.phone || '').slice(0, 40),
          })).filter((x) => x.name),
          schedule: (cs.schedule || []).slice(0, 30).map((x, i) => ({
            _key: 's' + i, time: String(x.time || '').slice(0, 30), what: String(x.what || '').slice(0, 200),
          })).filter((x) => x.what),
          kit: String(cs.kit || '').slice(0, 2000),
          notes: String(cs.notes || '').slice(0, 2000),
        },
      }).commit();
      await log(who, 'Updated a call sheet', b.workId, '');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
