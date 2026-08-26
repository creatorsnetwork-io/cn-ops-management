import { sanity } from '../../../../lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// The public side. Deliberately narrow: a freelancer sees the job, not the portal.
export async function GET(req, { params }) {
  const s = await sanity(true).fetch(
    `*[_type=="share" && token==$t][0]{
      _id, kind, at, note, revoked, responses, workId,
      "work": work->{title, kind, brief, acceptance, driveLink, docLink, due, callSheet, state,
                     "projectName": project->name, "client": project->client->name}}`,
    { t: params.token });

  if (!s) return Response.json({ ok: false, error: 'This link is not valid. Ask your contact at Creators Network for a new one.' }, { status: 404 });
  if (s.revoked) return Response.json({ ok: false, error: 'This link has been withdrawn.' }, { status: 403 });
  if (!s.work) return Response.json({ ok: false, error: 'The job behind this link is gone.' }, { status: 404 });

  const w = s.work;
  const base = { ok: true, kind: s.kind, note: s.note, client: w.client, project: w.projectName, title: w.title, due: w.due,
    responses: (s.responses || []).map((r) => ({ at: r.at, by: r.by, kind: r.kind, text: r.text })) };

  if (s.kind === 'brief')
    return Response.json({ ...base, brief: w.brief, acceptance: w.acceptance, driveLink: w.driveLink, docLink: w.docLink, state: w.state });

  return Response.json({ ...base, callSheet: w.callSheet || null, driveLink: w.driveLink });
}

export async function POST(req, { params }) {
  const b = await req.json();
  const s = await sanity(true).fetch('*[_type=="share" && token==$t][0]{_id,revoked,responses,workId,"workState":work->state}', { t: params.token });
  if (!s) return Response.json({ ok: false, error: 'This link is not valid.' }, { status: 404 });
  if (s.revoked) return Response.json({ ok: false, error: 'This link has been withdrawn.' }, { status: 403 });

  const by = String(b.by || '').slice(0, 80);
  const text = String(b.text || '').slice(0, 2000);
  const kind = ['accepted', 'declined', 'question', 'delivered'].includes(b.kind) ? b.kind : 'question';
  if (!by) return Response.json({ ok: false, error: 'Please put your name so we know who replied.' }, { status: 400 });
  if (kind === 'question' && !text) return Response.json({ ok: false, error: 'Write the question.' }, { status: 400 });

  const now = new Date().toISOString();

  // Delivery is a state move, not just a logged reply, so it gets its own path.
  if (kind === 'delivered') {
    const link = String(b.link || '').trim();
    if (!link) return Response.json({ ok: false, error: 'Paste the Drive link to what you made.' }, { status: 400 });
    if (s.workState !== 'progress')
      return Response.json({ ok: false, error: 'This job is not open for delivery right now. Ask your contact at Creators Network if you think that is wrong.' }, { status: 400 });

    const list = (s.responses || []).concat([{ _key: 'r' + Date.now(), at: now, by, kind, text }]);
    await sanity(true).patch(s._id).set({ responses: list }).commit();
    await sanity(true).patch(s.workId).set({ state: 'submitted', driveLink: link }).commit();
    await sanity(true).create({
      _type: 'activity', at: now, who: 'external:' + by,
      what: 'A freelancer delivered the job', target: s.workId, detail: link + (text ? ' — ' + text : ''),
    });
    return Response.json({ ok: true, kind, by, at: now, state: 'submitted' });
  }

  const list = (s.responses || []).concat([{ _key: 'r' + Date.now(), at: now, by, kind, text }]);
  await sanity(true).patch(s._id).set({ responses: list }).commit();

  await sanity(true).create({
    _type: 'activity', at: now, who: 'external:' + by,
    what: kind === 'accepted' ? 'A freelancer took the job' : kind === 'declined' ? 'A freelancer turned the job down' : 'A freelancer asked a question',
    target: s.workId, detail: text,
  });

  // A question or a refusal has to reach someone, so it lands as feedback on the item.
  if (kind !== 'accepted') {
    const w = await sanity(true).fetch('*[_id==$id][0]{feedback}', { id: s.workId });
    const fb = (w.feedback || []).concat([{
      _key: 'f' + Date.now(), at: now, who: 'freelancer ' + by,
      text: (kind === 'declined' ? 'Turned the job down. ' : '') + text, resolved: false,
    }]);
    await sanity(true).patch(s.workId).set({ feedback: fb }).commit();
  }

  return Response.json({ ok: true, kind, by, at: now });
}
