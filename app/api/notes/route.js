import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { forgetDoc } from '../../../lib/sheetcache';
import { noteFolders, scanFolder, docText, matchMeeting, recapFrom, proposalsFrom,
  KINDS, kindOf, readyToDraft, emailsIn, suggestFrom } from '../../../lib/notes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);
const idOf = (driveId) => 'meetingNote.' + String(driveId).replace(/[^A-Za-z0-9_-]/g, '');

async function context() {
  const c = sanity(true);
  const [clients, projects] = await Promise.all([
    c.fetch('*[_type=="client"]{slug,name,code,aliases}'),
    c.fetch('*[_type=="project" && status!="closed"]{slug,name,"clientSlug":client->slug}'),
  ]);
  return { clients: clients || [], projects: projects || [] };
}

export async function GET() {
  const who = meSlug();
  const c = sanity(true);
  try {
    const [notes, folders, clients, projects, vendors, prospects] = await Promise.all([
      c.fetch(`*[_type=="meetingNote"]|order(meetingAt desc)[0...500]{
        _id, driveId, title, meetingAt, viaShortcut, chars,
        kind, clientSlug, projectSlug, vendorId, prospectId, internal, matchWhy, emails,
        state, recap, proposals, decidedBy, decidedAt, note }`),
      noteFolders(),
      c.fetch('*[_type=="client"]|order(name asc){slug,name,code}'),
      c.fetch('*[_type=="project" && status!="closed"]|order(name asc){slug,name,"clientSlug":client->slug}'),
      c.fetch('*[_type=="vendor" && active==true]|order(name asc){_id,name,kind}'),
      c.fetch('*[_type=="prospect" && !defined(decidedAt)]|order(at desc)[0...100]{_id,name,stage}'),
    ]);
    return Response.json({
      ok: true, who, notes: notes || [], folders,
      clients: clients || [], projects: projects || [],
      vendors: vendors || [], prospects: prospects || [],
      kinds: KINDS,
      rights: {
        canApprove: softYes(can(who, 'approveRecap')),
        canScan: softYes(can(who, 'settings')),
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const c = sanity(true);
  const now = new Date().toISOString();

  try {
    // Walk the shared Drive folders and record every notes document found.
    // Nothing is read or drafted here, so this stays cheap and can be run often.
    if (b.action === 'scan') {
      if (!softYes(can(who, 'settings')))
        return Response.json({ ok: false, error: 'Only Himanshu or Aashif can scan Drive.' }, { status: 403 });

      const folders = await noteFolders();
      if (!folders.length)
        return Response.json({ ok: false, error: 'No Google Meet folders are configured yet. Add one on this screen first.' }, { status: 400 });

      const { clients, projects } = await context();
      const existing = new Set((await c.fetch('*[_type=="meetingNote"].driveId')) || []);
      let found = 0, added = 0, unreadable = 0, blocked = 0, reopened = 0;

      for (const f of folders) {
        let items = [];
        try { items = await scanFolder(f.id, 40); }
        catch (e) { unreadable++; continue; }
        for (const it of items) {
          found++;
          if (existing.has(it.driveId)) {
            // Keep an already recorded note honest about whether it can still be
            // opened. A folder share makes one readable, and an earlier scan that
            // did not check readability left some marked wrongly.
            const prev = await c.fetch('*[_id==$id][0]{state}', { id: idOf(it.driveId) });
            if (!prev) continue;
            if (it.readable && prev.state === 'unreadable') {
              await c.patch(idOf(it.driveId)).set({ state: 'found', matchWhy: 'Readable now.' }).commit();
              reopened++;
            } else if (!it.readable && prev.state === 'found') {
              await c.patch(idOf(it.driveId)).set({ state: 'unreadable', matchWhy: it.blocked }).commit();
              blocked++;
            }
            continue;
          }
          const m = matchMeeting(it.title, clients, projects);
          await c.createIfNotExists({
            _id: idOf(it.driveId), _type: 'meetingNote',
            driveId: it.driveId, title: it.title, meetingAt: it.meetingAt,
            viaShortcut: !!it.viaShortcut, owner: f.person || '',
            clientSlug: m.clientSlug, projectSlug: m.projectSlug,
            kind: m.internal ? 'internal' : (m.clientSlug ? 'client' : ''),
            internal: m.internal,
            matchWhy: it.readable ? m.why : it.blocked,
            state: it.readable ? 'found' : 'unreadable', foundAt: now,
          });
          if (!it.readable) blocked++;
          existing.add(it.driveId);
          added++;
        }
      }
      await log(who, 'Scanned Drive for meeting notes', '', added + ' new of ' + found + ' found');
      return Response.json({ ok: true, found, added, unreadable, blocked, reopened, folders: folders.length });
    }

    // Read one document and draft its recap. Never writes the recap anywhere but
    // onto this note, and never marks it accepted.
    if (b.action === 'draft') {
      const n = await c.fetch('*[_id==$id][0]', { id: b.id });
      if (!n) return Response.json({ ok: false, error: 'That note is no longer here.' }, { status: 404 });
      if (n.state === 'accepted')
        return Response.json({ ok: false, error: 'That recap is already accepted. Nothing further can rewrite it.' }, { status: 400 });
      const ready = readyToDraft(n);
      if (!ready.ok) return Response.json({ ok: false, error: ready.why }, { status: 400 });

      let text = '';
      try { text = await docText(n.driveId); }
      catch (e) {
        await c.patch(n._id).set({ state: 'unreadable', matchWhy: 'Drive refused: ' + e.message }).commit();
        return Response.json({ ok: false, error: 'The portal cannot open that document. Whoever hosted the meeting still needs to share their Google Meet folder.' }, { status: 403 });
      }

      const client = n.clientSlug
        ? await c.fetch('*[_type=="client" && slug==$s][0]{name}', { s: n.clientSlug }) : null;
      const recap = await recapFrom(text, client && client.name);

      await c.patch(n._id).set({
        recap, proposals: proposalsFrom(recap),
        state: 'drafted', draftedBy: who, draftedAt: now,
        chars: text.length, emails: emailsIn(text),
      }).commit();
      await log(who, 'Drafted a meeting recap', n._id, n.title);
      return Response.json({ ok: true, item: await c.fetch('*[_id==$id][0]', { id: n._id }), empty: recap.empty });
    }

    // Correct the client or project before drafting.
    if (b.action === 'attach') {
      const n = await c.fetch('*[_id==$id][0]{_id,state}', { id: b.id });
      if (!n) return Response.json({ ok: false, error: 'That note is no longer here.' }, { status: 404 });
      if (n.state === 'accepted')
        return Response.json({ ok: false, error: 'That recap is accepted, so what it is about is settled. Reject it first if it was filed wrongly.' }, { status: 400 });

      const kind = KINDS[b.kind] ? b.kind : '';
      // A meeting of any kind can still concern a client. An internal call about
      // STCH keeps STCH, which is the whole point of splitting these two fields.
      const patch = {
        kind,
        clientSlug: String(b.clientSlug || ''),
        projectSlug: String(b.projectSlug || ''),
        vendorId: kind === 'vendor' ? String(b.vendorId || '') : '',
        prospectId: kind === 'prospect' ? String(b.prospectId || '') : '',
        internal: kind === 'internal',
        matchWhy: 'Set by ' + who + '.',
      };
      if (patch.projectSlug && !patch.clientSlug) patch.projectSlug = '';
      await c.patch(n._id).set(patch).commit();
      return Response.json({ ok: true, item: await c.fetch('*[_id==$id][0]', { id: n._id }) });
    }

    // Read only the attendee list and say who this meeting looks like it was with.
    // Cheaper than a full recap and it works before anything is attached.
    if (b.action === 'identify') {
      const n = await c.fetch('*[_id==$id][0]{_id,driveId,title}', { id: b.id });
      if (!n) return Response.json({ ok: false, error: 'That note is no longer here.' }, { status: 404 });

      let text = '';
      try { text = await docText(n.driveId); }
      catch (e) {
        await c.patch(n._id).set({ state: 'unreadable', matchWhy: 'Drive refused: ' + e.message }).commit();
        return Response.json({ ok: false, error: 'The portal cannot open that document yet. Whoever hosted the meeting still needs to share their Google Meet folder.' }, { status: 403 });
      }

      const emails = emailsIn(text);
      const [clients, prospects] = await Promise.all([
        c.fetch('*[_type=="client"]{slug,name,contacts}'),
        c.fetch('*[_type=="prospect" && !defined(decidedAt)]{_id,name}'),
      ]);
      const guess = suggestFrom(emails, clients || [], prospects || []);
      await c.patch(n._id).set({ emails, matchWhy: guess.why }).commit();
      return Response.json({
        ok: true, emails, suggestion: guess,
        item: await c.fetch('*[_id==$id][0]', { id: n._id }),
      });
    }

    // A person accepts the recap. This is the only step that creates a decision
    // record, and it is why nothing upstream is allowed to write one.
    if (b.action === 'accept') {
      if (!softYes(can(who, 'approveRecap')))
        return Response.json({ ok: false, error: 'Your role does not approve recaps.' }, { status: 403 });
      const n = await c.fetch('*[_id==$id][0]', { id: b.id });
      if (!n) return Response.json({ ok: false, error: 'That note is no longer here.' }, { status: 404 });
      if (n.state !== 'drafted')
        return Response.json({ ok: false, error: 'Only a drafted recap can be accepted.' }, { status: 400 });

      const edited = b.recap && typeof b.recap === 'object' ? { ...n.recap, ...b.recap } : n.recap;
      const lines = []
        .concat((edited.decided || []).map((t) => ({ kind: 'decided', text: t })))
        .concat((edited.changed || []).map((t) => ({ kind: 'changed', text: t })))
        .concat((edited.rejected || []).map((t) => ({ kind: 'rejected', text: t })));

      for (let i = 0; i < lines.length; i++) {
        await c.create({
          _type: 'decision', at: n.meetingAt || now, kind: lines[i].kind, text: lines[i].text,
          clientSlug: n.clientSlug, projectSlug: n.projectSlug || '',
          sourceNote: n._id, sourceTitle: n.title, by: who, recordedAt: now,
        });
      }

      await c.patch(n._id).set({
        recap: edited, state: 'accepted', decidedBy: who, decidedAt: now,
        note: String(b.note || '').slice(0, 500),
      }).commit();
      await log(who, 'Accepted a meeting recap', n._id, lines.length + ' decisions recorded');
      forgetDoc('settings.notes');
      return Response.json({ ok: true, item: await c.fetch('*[_id==$id][0]', { id: n._id }), decisions: lines.length });
    }

    if (b.action === 'reject') {
      if (!softYes(can(who, 'approveRecap')))
        return Response.json({ ok: false, error: 'Your role does not approve recaps.' }, { status: 403 });
      if (!String(b.note || '').trim())
        return Response.json({ ok: false, error: 'Say what was wrong with it, otherwise the same mistake comes back next week.' }, { status: 400 });
      const n = await c.fetch('*[_id==$id][0]{_id,title}', { id: b.id });
      if (!n) return Response.json({ ok: false, error: 'That note is no longer here.' }, { status: 404 });
      await c.patch(n._id).set({
        state: 'rejected', decidedBy: who, decidedAt: now, note: String(b.note).slice(0, 500),
      }).commit();
      await log(who, 'Rejected a meeting recap', n._id, String(b.note).slice(0, 120));
      return Response.json({ ok: true, item: await c.fetch('*[_id==$id][0]', { id: n._id }) });
    }

    // Which Google Meet folders to read. One row per person.
    if (b.action === 'folders') {
      if (!softYes(can(who, 'settings')))
        return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change this.' }, { status: 403 });
      const rows = (Array.isArray(b.folders) ? b.folders : [])
        .map((f, i) => ({
          _key: 'f' + i,
          id: String((f && f.id) || '').trim().replace(/^.*folders\//, '').split('?')[0],
          person: String((f && f.person) || '').trim().slice(0, 60),
        }))
        .filter((f) => f.id).slice(0, 20);
      await c.createOrReplace({ _id: 'settings.notes', _type: 'settings', folders: rows });
      forgetDoc('settings.notes');
      await log(who, 'Changed which Drive folders are read for meeting notes', '', rows.length + ' folders');
      return Response.json({ ok: true, folders: rows });
    }

    return Response.json({ ok: false, error: 'That is not something this screen does.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
