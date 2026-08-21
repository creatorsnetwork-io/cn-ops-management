import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { KINDS } from '../../../lib/work';
import { log } from '../../../lib/week';
import { raiseEscalation } from '../../../lib/escalate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Unplanned client asks. The point is not a nicer inbox, it is that work nobody
// agreed to stops being invisible.
const P = `{
  _id, at, receivedBy, from, channel, what, state, inScope, decision, decidedBy, decidedAt, due,
  "clientSlug": client->slug, "clientName": client->name,
  "projectSlug": project->slug, "projectName": project->name,
  "workId": work->_id, "workTitle": work->title, "workState": work->state
}`;

const CAN_TRIAGE = (who) => ['yes', 'oversight'].includes(can(who, 'triageFeedback')) || ['himanshu', 'aashif'].includes(who);

export async function GET() {
  try {
    const items = await sanity(true).fetch(`*[_type=="request"]|order(at desc)[0...300]${P}`);
    return Response.json({ ok: true, items, who: meSlug(), canTriage: CAN_TRIAGE(meSlug()) });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 200) });
  }
}

export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (b.action === 'log') {
      if (!b.clientSlug || !String(b.what || '').trim())
        return Response.json({ ok: false, error: 'Which client, and what did they ask for.' }, { status: 400 });
      const doc = await c.create({
        _type: 'request', at: b.at || now, receivedBy: who,
        from: String(b.from || '').slice(0, 120),
        channel: ['whatsapp', 'email', 'call', 'meeting'].includes(b.channel) ? b.channel : 'whatsapp',
        what: String(b.what).slice(0, 3000),
        due: b.due || null,
        state: 'new', inScope: 'unclear',
        client: { _type: 'reference', _ref: 'client.' + b.clientSlug },
        project: b.projectSlug ? { _type: 'reference', _ref: 'project.' + b.projectSlug } : undefined,
      });
      await log(who, 'Logged a client request', doc._id, String(b.what).slice(0, 120));
      return Response.json({ ok: true, id: doc._id });
    }

    if (!CAN_TRIAGE(who)) return Response.json({ ok: false, error: 'Your role does not decide on requests.' }, { status: 403 });
    if (!b.id) return Response.json({ ok: false, error: 'Nothing selected.' }, { status: 400 });
    const r = await sanity(true).fetch(`*[_id==$id][0]${P}`, { id: b.id });
    if (!r) return Response.json({ ok: false, error: 'That request no longer exists.' }, { status: 404 });

    if (b.action === 'scope') {
      const inScope = ['yes', 'no', 'unclear'].includes(b.inScope) ? b.inScope : 'unclear';
      await c.patch(b.id).set({ inScope, decidedBy: who, decidedAt: now }).commit();
      await log(who, 'Marked a request ' + (inScope === 'yes' ? 'in scope' : inScope === 'no' ? 'out of scope' : 'unclear'), b.id, '');
      if (inScope === 'no') {
        await raiseEscalation({
          who, reason: 'Client asked for work outside the retainer',
          detail: (r.clientName || '') + ': ' + String(r.what || '').slice(0, 300),
          target: b.id, projectSlug: r.projectSlug || null, kind: 'auto',
        });
      }
      return Response.json({ ok: true });
    }

    if (b.action === 'accept') {
      if (!b.projectSlug) return Response.json({ ok: false, error: 'Pick which project this belongs to.' }, { status: 400 });
      const kind = KINDS[b.kind] ? b.kind : 'other';
      const w = await c.create({
        _type: 'work', createdAt: now, createdBy: who,
        title: String(b.title || r.what).slice(0, 200),
        kind, needsCraft: KINDS[kind].craft, state: 'briefed',
        due: b.due || r.due || null,
        brief: 'Asked for by ' + (r.from || 'the client') + ' over ' + r.channel + ' on '
          + new Date(r.at).toLocaleDateString('en-GB') + '.\n\n' + (r.what || ''),
        acceptance: String(b.acceptance || '').slice(0, 1000),
        project: { _type: 'reference', _ref: 'project.' + b.projectSlug },
        assignee: b.assignee ? { _type: 'reference', _ref: 'person.' + b.assignee } : undefined,
        owner: { _type: 'reference', _ref: 'person.' + who },
        history: [{ _key: 'h' + Date.now(), at: now, who, from: '', to: 'briefed', note: 'Came in as an unplanned request' }],
        feedback: [], fromRequest: { _type: 'reference', _ref: b.id, _weak: true },
      });
      await c.patch(b.id).set({
        state: 'accepted', decision: String(b.note || '').slice(0, 600), decidedBy: who, decidedAt: now,
        work: { _type: 'reference', _ref: w._id, _weak: true },
      }).commit();
      await log(who, 'Turned a request into work', w._id, r.what ? String(r.what).slice(0, 120) : '');
      return Response.json({ ok: true, workId: w._id });
    }

    if (b.action === 'decline' || b.action === 'park') {
      if (!String(b.note || '').trim())
        return Response.json({ ok: false, error: 'Write the reason. This is the record you will quote back to them.' }, { status: 400 });
      await c.patch(b.id).set({
        state: b.action === 'decline' ? 'declined' : 'parked',
        decision: String(b.note).slice(0, 600), decidedBy: who, decidedAt: now,
      }).commit();
      await log(who, b.action === 'decline' ? 'Declined a request' : 'Parked a request', b.id, b.note);
      return Response.json({ ok: true });
    }

    if (b.action === 'reopen') {
      await c.patch(b.id).set({ state: 'new', decision: '', decidedBy: null, decidedAt: null }).commit();
      await log(who, 'Reopened a request', b.id, '');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
