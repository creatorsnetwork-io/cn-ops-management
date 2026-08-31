import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';
import { raiseEscalation } from '../../../lib/escalate';
import { CADENCE } from '../../../lib/model';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPES = {
  social: 'Social retainer',
  website: 'Website',
  seo: 'SEO',
  influencer: 'Influencer or creator campaign',
  video: 'Film or shoot',
  aiVideo: 'AI video',
  events: 'Event',
};

// Creating a project is `yes` for ops and `request` for the brand and SEO side.
// A request does not quietly do nothing: it raises a decision for their lead.
export async function POST(req) {
  const who = meSlug();
  const b = await req.json();
  const right = await can(who, 'createProject');

  if (right === 'no')
    return Response.json({ ok: false, error: 'Your role does not open projects.' }, { status: 403 });

  const name = String(b.name || '').trim();
  if (!name || !b.clientSlug)
    return Response.json({ ok: false, error: 'A client and a name are the minimum.' }, { status: 400 });
  const type = TYPES[b.type] ? b.type : 'social';

  try {
    if (right === 'request') {
      const doc = await raiseEscalation({
        who, reason: 'Asked to open a new project',
        detail: name + ', ' + TYPES[type] + ', for ' + b.clientSlug
          + (b.why ? '. Reason given: ' + String(b.why).slice(0, 400) : ''),
        kind: 'manual',
      });
      await log(who, 'Requested a new project', doc._id, name);
      return Response.json({ ok: true, requested: true, id: doc._id });
    }

    const base = String(b.slug || (b.clientSlug + '-' + name)).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!base) return Response.json({ ok: false, error: 'That name has no letters or numbers in it.' }, { status: 400 });

    let slug = base, n = 2;
    while (await sanity(true).fetch('*[_id==$id][0]{_id}', { id: 'project.' + slug })) { slug = base + '-' + n; n++; }

    const client = await sanity(true).fetch('*[_id==$id][0]{_id,name}', { id: 'client.' + b.clientSlug });
    if (!client) return Response.json({ ok: false, error: 'No such client.' }, { status: 400 });

    await sanity(true).create({
      _id: 'project.' + slug, _type: 'project', slug,
      name: name.slice(0, 160), type, cadence: CADENCE[type] || 'milestone',
      status: 'active',
      client: { _type: 'reference', _ref: 'client.' + b.clientSlug },
      owner: { _type: 'reference', _ref: 'person.' + (b.owner || who) },
      calendarSources: [], deliverables: [], milestones: [],
    });
    await log(who, 'Opened a project', 'project.' + slug, name + ' for ' + client.name);
    return Response.json({ ok: true, slug });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}

// Removing something opened by mistake. Refuses the moment anything real is
// attached, so this can never be a way to lose history.
export async function DELETE(req) {
  const who = meSlug();
  if ((await can(who, 'closeProject')) !== 'yes')
    return Response.json({ ok: false, error: 'Only Himanshu or Aashif can remove a project.' }, { status: 403 });
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return Response.json({ ok: false, error: 'Which project.' }, { status: 400 });

  const counts = await sanity(true).fetch(
    `{"work": count(*[_type=="work" && project->slug==$s]),
      "weeks": count(*[_type=="weekReview" && projectSlug==$s]),
      "months": count(*[_type=="monthCycle" && projectSlug==$s]),
      "snaps": count(*[_type=="snapshot" && projectSlug==$s]),
      "esc": count(*[_type=="escalation" && project->slug==$s])}`, { s: slug });
  const attached = Object.keys(counts).filter((k) => counts[k] > 0);
  if (attached.length)
    return Response.json({
      ok: false,
      error: 'This has history against it, so it cannot be removed. Close it instead. Attached: '
        + attached.map((k) => counts[k] + ' ' + k).join(', '),
    }, { status: 400 });

  await sanity(true).delete('project.' + slug);
  await log(who, 'Removed an empty project', 'project.' + slug, '');
  return Response.json({ ok: true });
}
