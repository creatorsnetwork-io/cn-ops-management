import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { log } from '../../../lib/week';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ID = 'settings.house';

export async function GET() {
  const s = await sanity(true).fetch('*[_id==$id][0]', { id: ID });
  return Response.json({ ok: true, settings: s || { _id: ID, bannedPhrases: [], digestHour: 8, digestTz: 'Asia/Dubai' } });
}

export async function POST(req) {
  const who = meSlug();
  if ((await can(who, 'settings')) !== 'yes') return Response.json({ ok: false, error: 'Only Himanshu or Aashif can change settings.' }, { status: 403 });
  const b = await req.json();
  const c = sanity(true);

  try {
    if (b.scope === 'house') {
      const patch = {};
      if (Array.isArray(b.bannedPhrases))
        patch.bannedPhrases = b.bannedPhrases.map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 200);
      if (b.digestHour !== undefined) patch.digestHour = Math.max(0, Math.min(23, +b.digestHour || 0));
      if (Array.isArray(b.limits)) {
        patch.limits = b.limits.slice(0, 20).map((x, i) => ({
          _key: 'l' + i,
          channel: String(x.channel || '').slice(0, 40),
          chars: Math.max(1, Math.min(200000, +x.chars || 1)),
          tagsMin: Math.max(0, Math.min(50, +x.tagsMin || 0)),
          tagsMax: Math.max(0, Math.min(50, +x.tagsMax || 0)),
        })).filter((x) => x.channel);
      }
      if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
      await c.createIfNotExists({ _id: ID, _type: 'settings', bannedPhrases: [], digestHour: 8 });
      await c.patch(ID).set(patch).commit();
      await log(who, 'Changed house settings', ID, Object.keys(patch).join(', '));
      return Response.json({ ok: true });
    }

    if (b.scope === 'voice') {
      if (!b.slug) return Response.json({ ok: false, error: 'No project given.' }, { status: 400 });
      await c.patch('project.' + b.slug).set({ voice: String(b.voice || '').slice(0, 4000) }).commit();
      await log(who, 'Changed a client voice note', 'project.' + b.slug, '');
      return Response.json({ ok: true });
    }

    if (b.scope === 'project') {
      if (!b.slug) return Response.json({ ok: false, error: 'No project given.' }, { status: 400 });
      const words = (b.extraBanned || []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 200);
      await c.patch('project.' + b.slug).set({ extraBanned: words }).commit();
      await log(who, 'Changed a project word list', 'project.' + b.slug, words.length + ' words');
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Unknown scope.' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
