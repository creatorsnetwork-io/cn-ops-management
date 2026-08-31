import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { ClientsBrowse } from '../../../components/Browse';
import { evaluate } from '../../../lib/onboard';

export const dynamic = 'force-dynamic';

// Health is worked out from real signals, not stored. A stored health field is a
// field somebody has to remember to update, which means it is always wrong.
function healthOf(c) {
  if (c.escalations || c.late) return 'Needs attention';
  if (c.note && /leaving|ends|winding/i.test(c.note)) return 'Winding down';
  if (c.projects.some((p) => p.type === 'social' && !p.cals)) return 'Watch';
  if (!c.projects.length) return 'Onboarding';
  return 'On track';
}

export default async function Clients() {
  const who = meSlug();
  if (!(await pageAllowed(who, '/clients'))) return <NotYours what="Clients" />;

  const today = new Date().toISOString().slice(0, 10);
  let rows = [], favs = [], error = null;

  try {
    const [raw, person] = await Promise.all([
      sanity(true).fetch(
        `*[_type=="client" && active != false]|order(name asc){
        slug, name, code, note, driveFolderId, logoUrl, contacts, onbManual, brand,
        renewal, clientType, industry, businessType,
        "projects": *[_type=="project" && references(^._id)]{
          slug, type, voice, prd, contract, deliverables,
          "owner": owner->name, "cals": count(calendarSources[current==true])},
        "briefs": count(*[_type=="work" && project->client->slug == ^.slug && defined(brief) && brief != ""]),
        "late": count(*[_type=="work" && project->client->slug == ^.slug
              && !(state in ["approved","done"]) && defined(due) && due < $today]),
        "escalations": count(*[_type=="escalation" && project->client->slug == ^.slug && !defined(resolvedAt)])
      }`, { today }),
      sanity(true).fetch('*[_id==$id][0]{favClients}', { id: 'person.' + who }),
    ]);
    favs = (person && person.favClients) || [];

    rows = raw.map((c) => {
      // The lead is whoever owns most of the work, rather than another field to maintain.
      const tally = {};
      for (const p of c.projects) if (p.owner) tally[p.owner] = (tally[p.owner] || 0) + 1;
      const lead = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
      const setup = evaluate(c);
      const out = {
        ...c,
        lead,
        typeLabel: c.clientType || c.industry || c.businessType || 'Not set',
        brain: setup.done[2] ? 'Written' : 'Missing',
        setup: setup.count,
        contactCount: (c.contacts || []).length,
        approvers: (c.contacts || []).filter((x) => x.canApprove).length,
      };
      return { ...out, health: healthOf(out) };
    });

  } catch (e) { error = e.message; }

  const addShade = await can(who, 'createClient');

  return (
    <>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <ClientsBrowse who={who} rows={rows} favs={favs} addShade={addShade} />
    </>
  );
}
