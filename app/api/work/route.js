import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { VERBS, verbCheck, KINDS, canCreateWork, canAssign, assignableTo } from '../../../lib/work';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROJECTION = `{
  _id, title, kind, state, due, brief, acceptance, driveLink, docLink, firstTime, needsCraft,
  createdAt, deliverable, history, feedback,
  "assignee": assignee->slug, "assigneeName": assignee->name,
  "owner": owner->slug, "ownerName": owner->name,
  "vendorId": vendor._ref, "vendorName": vendor->name,
  "projectSlug": project->slug, "projectName": project->name, "client": project->client->name
}`;

async function one(id) { return sanity(true).fetch(`*[_id==$id][0]${PROJECTION}`, { id }); }

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  try {
    if (id) return Response.json({ ok: true, item: await one(id), who: meSlug() });
    const slug = q.get('slug');
    const items = await sanity(true).fetch(
      `*[_type=="work" ${slug ? '&& project->slug==$s' : ''}]|order(due asc, createdAt desc)[0...400]${PROJECTION}`,
      slug ? { s: slug } : {});
    return Response.json({ ok: true, items, who: meSlug() });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 200) });
  }
}

export async function POST(req) {
  const who = meSlug();
  const body = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    if (body.action === 'create') {
      if (!canCreateWork(who)) return Response.json({ ok: false, error: 'Your role cannot open new work.' }, { status: 403 });
      if (!body.projectSlug || !body.title) return Response.json({ ok: false, error: 'A project and a title are the minimum.' }, { status: 400 });
      const allowed = assignableTo(who);
      if (body.assignee && allowed !== null && !allowed.includes(body.assignee))
        return Response.json({ ok: false, error: 'You can only give work to your own team.' }, { status: 403 });
      const kind = KINDS[body.kind] ? body.kind : 'other';
      const doc = await c.create({
        _type: 'work', createdAt: now, createdBy: who,
        title: String(body.title).slice(0, 200),
        kind, needsCraft: body.needsCraft != null ? !!body.needsCraft : KINDS[kind].craft,
        state: 'briefed',
        due: body.due || null,
        brief: String(body.brief || '').slice(0, 4000),
        acceptance: String(body.acceptance || '').slice(0, 1000),
        driveLink: String(body.driveLink || '').slice(0, 500),
        docLink: String(body.docLink || '').slice(0, 500),
        firstTime: !!body.firstTime,
        deliverable: String(body.deliverable || '').slice(0, 120),
        project: { _type: 'reference', _ref: 'project.' + body.projectSlug },
        assignee: body.assignee ? { _type: 'reference', _ref: 'person.' + body.assignee } : undefined,
        vendor: body.vendorId ? { _type: 'reference', _ref: body.vendorId, _weak: true } : undefined,
        owner: { _type: 'reference', _ref: 'person.' + (body.owner || who) },
        history: [{ _key: 'h' + Date.now(), at: now, who, from: '', to: 'briefed', note: 'Briefed' }],
        feedback: [],
      });
      await log(who, 'Opened work', doc._id, body.title);
      return Response.json({ ok: true, item: await one(doc._id) });
    }

    if (body.action === 'move') {
      const item = await one(body.id);
      if (!item) return Response.json({ ok: false, error: 'That item no longer exists.' }, { status: 404 });
      const v = VERBS[body.verb];
      const check = verbCheck(body.verb, item, who);
      if (!check.ok) return Response.json({ ok: false, error: check.why }, { status: 403 });
      if (v.needNote && !String(body.note || '').trim())
        return Response.json({ ok: false, error: 'Say what needs changing, otherwise the person picking this up is guessing.' }, { status: 400 });
      if (v.needLink && !String(body.link || item.driveLink || '').trim())
        return Response.json({ ok: false, error: 'Paste the Drive link to what you produced.' }, { status: 400 });
      if (v.needWho && !String(body.clientName || '').trim())
        return Response.json({ ok: false, error: 'Name the person at the client who approved it.' }, { status: 400 });

      const hist = (item.history || []).concat([{
        _key: 'h' + Date.now(), at: now, who, from: item.state, to: v.to,
        note: body.note || '', clientName: body.clientName || '',
      }]);
      const patch = { state: v.to, history: hist };
      if (body.link) patch.driveLink = String(body.link).slice(0, 500);
      if (v.to === 'approved') { patch.approvedBy = body.clientName; patch.approvedAt = now; }
      await c.patch(item._id).set(patch).commit();
      await log(who, v.label, item._id, body.note || body.clientName || '');

      if (['craftBack', 'shipBack', 'clientBack'].includes(body.verb)) {
        const fb = (item.feedback || []).concat([{
          _key: 'f' + Date.now(), at: now, who: body.verb === 'clientBack' ? 'client' : who,
          text: body.note, resolved: false,
        }]);
        await c.patch(item._id).set({ feedback: fb }).commit();
      }
      return Response.json({ ok: true, item: await one(item._id) });
    }

    if (body.action === 'feedbackDone') {
      const item = await one(body.id);
      if (!item) return Response.json({ ok: false, error: 'That item no longer exists.' }, { status: 404 });
      const fb = (item.feedback || []).map((f) => (f._key === body.key ? { ...f, resolved: true, resolvedBy: who, resolvedAt: now } : f));
      await c.patch(item._id).set({ feedback: fb }).commit();
      await log(who, 'Marked feedback handled', item._id, '');
      return Response.json({ ok: true, item: await one(item._id) });
    }

    if (body.action === 'edit' || body.action === 'assign') {
      const item = await one(body.id);
      if (!item) return Response.json({ ok: false, error: 'That item no longer exists.' }, { status: 404 });
      const ops = ['himanshu', 'aashif'].includes(who);
      const patch = {};

      if (body.action === 'edit') {
        if (!ops) return Response.json({ ok: false, error: 'Only Himanshu or Aashif can rewrite the brief. You can change who is doing it and when it is due.' }, { status: 403 });
        for (const f of ['title', 'brief', 'acceptance', 'driveLink', 'docLink', 'deliverable']) if (typeof body[f] === 'string') patch[f] = body[f].slice(0, 4000);
        if (body.firstTime !== undefined) patch.firstTime = !!body.firstTime;
      }

      if (body.assignee !== undefined || body.due !== undefined || body.vendorId !== undefined) {
        const check = canAssign(item, who);
        if (!check.ok) return Response.json({ ok: false, error: check.why }, { status: 403 });
        if (body.assignee !== undefined) {
          if (body.assignee && check.list !== null && !check.list.includes(body.assignee))
            return Response.json({ ok: false, error: 'You can only give work to your own team.' }, { status: 403 });
          patch.assignee = body.assignee ? { _type: 'reference', _ref: 'person.' + body.assignee } : null;
        }
        if (body.due !== undefined) patch.due = body.due || null;
        // Record keeping only, same as assignee: who is actually doing the work
        // outside the team. Nothing else reads this yet.
        if (body.vendorId !== undefined) patch.vendor = body.vendorId ? { _type: 'reference', _ref: body.vendorId, _weak: true } : null;
      }

      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.patch(body.id).set(patch).commit();

      const named = patch.assignee === null ? 'nobody' : (body.assignee || '');
      if ('assignee' in patch) {
        const hist = (item.history || []).concat([{
          _key: 'h' + Date.now(), at: now, who, from: item.state, to: item.state,
          note: 'Given to ' + (named || 'nobody') + (item.assignee ? ', was with ' + item.assignee : ''),
        }]);
        await c.patch(body.id).set({ history: hist }).commit();
      }
      await log(who, 'assignee' in patch ? 'Assigned work' : 'Edited work', body.id, Object.keys(patch).join(', '));
      return Response.json({ ok: true, item: await one(body.id) });
    }

    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
