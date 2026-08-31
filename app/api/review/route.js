import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { readProjectWeek, loadReview, ensureReview, reviewId, fingerprint, log, forgetProject } from '../../../lib/week';
import { cachedDoc } from '../../../lib/sheetcache';
import { runChecks, byItem, blocking } from '../../../lib/qc';
import { raiseEscalation } from '../../../lib/escalate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

// Re-marks stored flags against the current waivers, so pressing Not required
// updates the gate immediately instead of waiting for the next check run.
function recheck(flags, items, waivers, rules) {
  const byKey = {};
  for (const i of items) byKey[i.key] = i;
  return (flags || []).map((f) => {
    const item = byKey[f.key] || {};
    const type = String(item.type || '').trim().toLowerCase();
    const once = (waivers || []).find((w) => w.key === f.key && w.code === f.code && (!w.channel || w.channel === (f.channel || '')));
    const rule = (rules || []).find((r) => r.code === f.code
      && (!r.channel || r.channel === (f.channel || ''))
      && String(r.postType || '').trim().toLowerCase() === type);
    const w = once || rule;
    if (!w) { const { waived, waivedBy, waivedScope, ...rest } = f; return rest; }
    return { ...f, waived: true, waivedBy: w.by || '', waivedScope: rule && !once ? 'rule' : 'once' };
  });
}

const softYes = (v) => ['yes', 'exception', 'oversight'].includes(v);

// Standing rules change what blocks a gate, so they are always read fresh.
async function freshRules(slug) {
  const p = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{qcRules}', { s: slug });
  return (p && p.qcRules) || [];
}

async function perms(who) {
  const [craft, ship, share, generate, shipOverride, triageFeedback] = await Promise.all([
    can(who, 'approveCraft'),
    can(who, 'shipGate'),
    can(who, 'shareClientLink'),
    can(who, 'generate'),
    can(who, 'shipOverride'),
    can(who, 'triageFeedback'),
  ]);
  return {
    who, craft, ship, share, generate, shipOverride, triageFeedback,
    canCraft: ['yes', 'exception', 'oversight'].includes(craft),
    canShip: ['yes', 'exception', 'oversight'].includes(ship),
  };
}

function shape(d, week, items) {
  const r = d || {};
  const state = {};
  for (const it of r.items || []) state[it.key] = it;
  const cd = {};
  for (const dd of r.clientDecisions || []) cd[dd.key] = dd;
  return {
    week,
    clientToken: r.clientToken || null,
    sharedAt: r.sharedAt || null,
    clientApproved: (r.clientDecisions || []).filter((x) => x.decision === 'approved').length,
    clientChanges: (r.clientDecisions || []).filter((x) => x.decision === 'changes').length,
    items: items.map((i) => ({ ...i, review: state[i.key] || { key: i.key, craft: 'pending' }, client: cd[i.key] || null })),
    flags: byItem(r.flags || []),
    flagCount: (r.flags || []).length,
    blocking: blocking(r.flags || []).length,
    qcAt: r.qcAt || null, qcBy: r.qcBy || null,
    waivers: r.waivers || [],
    toneAt: r.toneAt || null, toneBy: r.toneBy || null, toneModel: r.toneModel || null,
    tone: (r.toneFlags || []).reduce((m, f) => { (m[f.key] = m[f.key] || []).push(f); return m; }, {}),
    toneCount: (r.toneFlags || []).length,
    imageAt: r.imageAt || null, imageBy: r.imageBy || null,
    image: (r.imageFlags || []).reduce((m, f) => { (m[f.key] = m[f.key] || []).push(f); return m; }, {}),
    imageCount: (r.imageFlags || []).length,
    craftGate: r.craftGate || null,
    shipGate: r.shipGate || null,
    drift: (r.items || []).filter((it) => it.craft === 'approved' && state[it.key] &&
      items.find((x) => x.key === it.key) && it.fingerprint &&
      it.fingerprint !== fingerprint(items.find((x) => x.key === it.key))).map((it) => it.key),
  };
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const slug = q.get('slug');
  const who = meSlug();
  if (!slug) return Response.json({ ok: false, error: 'No project given.' }, { status: 400 });

  try {
    const w = await readProjectWeek(slug, q.get('week'));
    if (w.error) return Response.json({ ok: false, error: w.error, project: w.project || null, week: w.week });
    const review = await loadReview(slug, w.week);
    return Response.json({
      ok: true, project: w.project, source: w.source, sheetTitle: w.sheetTitle, tab: w.tab,
      perms: await perms(who), qcRules: await freshRules(slug), ...shape(review, w.week, w.items),
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}

export async function POST(req) {
  const who = meSlug();
  const body = await req.json();
  const { slug, week, action } = body;
  if (!slug || !week || !action) return Response.json({ ok: false, error: 'Missing details.' }, { status: 400 });

  const p = await perms(who);
  const id = reviewId(slug, week);
  const c = sanity(true);

  try {
    const w = await readProjectWeek(slug, week);
    if (w.error) return Response.json({ ok: false, error: w.error });
    await ensureReview(slug, week);
    const now = new Date().toISOString();

    if (action === 'qc') {
      const house = await cachedDoc('house', 60 * 1000, () =>
        sanity(true).fetch('*[_id=="settings.house"][0]{bannedPhrases,limits}'));
      const existing = await loadReview(slug, week);
      const raw = runChecks(w.items, {
        extraBanned: (w.project.extraBanned || []).concat((house && house.bannedPhrases) || []),
        limits: (house && house.limits) || null,
        waivers: (existing && existing.waivers) || [],
        rules: await freshRules(slug),
      });
      const byKey = {};
      for (const it of w.items) byKey[it.key] = it;
      const flags = raw.map((f, n) => {
        const it = byKey[f.key] || {};
        return {
          ...f, _key: 'f' + n,
          label: [it.date, it.type, it.title].filter(Boolean).join(' · ') || f.key,
          creativeLink: it.creativeLink || '',
        };
      });
      await c.patch(id).set({ flags, qcAt: now, qcBy: who }).commit();
      await log(who, 'Ran quality checks', id, flags.length + ' flags, ' + blocking(flags).length + ' blocking');
    }

    // "Not required." Either this one row, or a standing rule for this kind of post.
    else if (action === 'waive' || action === 'unwaive') {
      if (!softYes(await can(who, 'approveCraft')) && !softYes(await can(who, 'shipGate')) && !softYes(await can(who, 'triageFeedback')))
        return Response.json({ ok: false, error: 'Your role does not decide what is required.' }, { status: 403 });

      const r = await loadReview(slug, week);
      const list = (r && r.waivers) || [];

      if (action === 'unwaive') {
        const next = list.filter((x) => !(x.key === body.key && x.code === body.code && (x.channel || '') === (body.channel || '')));
        await c.patch(id).set({ waivers: next }).commit();
        if (body.alsoRule || body.postType) {
          const proj = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{qcRules}', { s: slug });
          const rules = (proj.qcRules || []).filter((x) =>
            !(x.code === body.code && (x.channel || '') === (body.channel || '')
              && String(x.postType || '').trim().toLowerCase() === String(body.postType || '').trim().toLowerCase()));
          await sanity(true).patch('project.' + slug).set({ qcRules: rules }).commit();
          forgetProject(slug);
        }
        await log(who, 'Put a requirement back', id, body.code + ' ' + (body.channel || ''));
      } else {
        const always = body.scope === 'always' && body.postType;

        // A one-off waiver only for "just this one". Otherwise the rule is the
        // whole record, and the row is not a special case.
        if (!always) {
          const entry = {
            _key: 'w' + Date.now(), key: body.key, code: body.code,
            channel: body.channel || '', by: who, at: now, note: String(body.note || '').slice(0, 300),
          };
          await c.patch(id).set({ waivers: list.filter((x) =>
            !(x.key === entry.key && x.code === entry.code && (x.channel || '') === entry.channel)).concat([entry]) }).commit();
        }

        if (always) {
          const proj = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{qcRules}', { s: slug });
          const rules = (proj.qcRules || []).filter((x) =>
            !(x.code === body.code && (x.channel || '') === (body.channel || '') && x.postType === body.postType));
          rules.push({ _key: 'r' + Date.now(), code: body.code, channel: body.channel || '',
            postType: String(body.postType).slice(0, 80), by: who, at: now });
          await sanity(true).patch('project.' + slug).set({ qcRules: rules }).commit();
          forgetProject(slug);
          await log(who, 'Made a standing rule', 'project.' + slug,
            body.code + ' not required on ' + body.postType + (body.channel ? ' for ' + body.channel : ''));
        } else {
          await log(who, 'Marked something not required', id, body.code + ' on ' + body.key);
        }
      }

      // the flags carry the waived mark, so recompute them
      const cur = await loadReview(slug, week);
      if (cur && cur.flags) {
        const proj = await sanity(true).fetch('*[_type=="project" && slug==$s][0]{qcRules}', { s: slug });
        const marked = recheck(cur.flags, w.items, (cur.waivers || []), (proj.qcRules || []));
        await c.patch(id).set({ flags: marked }).commit();
      }
    }

    else if (action === 'craft') {
      if (!p.canCraft) return Response.json({ ok: false, error: 'You cannot sign off creative.' }, { status: 403 });
      const keys = body.keys || [];
      const decision = body.decision === 'changes' ? 'changes' : 'approved';
      const existing = (await loadReview(slug, week)).items || [];
      const map = {};
      for (const it of existing) map[it.key] = it;
      for (const k of keys) {
        const item = w.items.find((x) => x.key === k);
        map[k] = {
          _key: k.replace(/[^A-Za-z0-9]/g, '_'), key: k, craft: decision,
          craftBy: who, craftAt: now, craftNote: body.note || '',
          fingerprint: item ? fingerprint(item) : '',
        };
      }
      await c.patch(id).set({ items: Object.values(map), craftGate: null, shipGate: null }).commit();
      await log(who, decision === 'approved' ? 'Approved creative' : 'Asked for creative changes', id, keys.join(', '));
    }

    else if (action === 'craftGate') {
      if (!p.canCraft) return Response.json({ ok: false, error: 'You cannot sign the craft gate.' }, { status: 403 });
      const r = await loadReview(slug, week);
      const state = {};
      for (const it of r.items || []) state[it.key] = it;
      const notDone = w.items.filter((i) => (state[i.key] || {}).craft !== 'approved');
      if (notDone.length) return Response.json({ ok: false, error: notDone.length + ' item(s) are not creative approved yet.' });
      await c.patch(id).set({ craftGate: { by: who, at: now } }).commit();
      await log(who, 'Signed the craft gate', id, w.items.length + ' items');
    }

    else if (action === 'ship') {
      if (!p.canShip && !(body.override && softYes(await can(who, 'shipOverride'))))
        return Response.json({ ok: false, error: 'You cannot sign the ship gate.' }, { status: 403 });
      if (body.override && !softYes(await can(who, 'shipOverride')))
        return Response.json({ ok: false, error: 'Sending with flags open is limited to Himanshu, Aashif and Priyanka.' }, { status: 403 });
      const r = await loadReview(slug, week);
      if (!r.craftGate) return Response.json({ ok: false, error: 'The craft gate is not signed yet.' });
      if (!r.qcAt) return Response.json({ ok: false, error: 'Quality checks have not been run for this week.' });
      const block = blocking(r.flags || []);
      if (block.length && !body.override)
        return Response.json({ ok: false, error: block.length + ' blocking flag(s) still open.', blocking: block });
      await c.patch(id).set({
        shipGate: { by: who, at: now, override: !!body.override, overrideNote: body.note || '' },
        shipped: w.items.length,
      }).commit();
      await log(who, body.override ? 'Signed the ship gate with an override' : 'Signed the ship gate', id, body.note || '');
      if (body.override) {
        await raiseEscalation({
          who, reason: 'Shipped with blocking flags open',
          detail: body.note || '', projectSlug: slug, target: id, kind: 'auto',
        });
      }
    }

    else if (action === 'share') {
      if (!['yes'].includes(await can(who, 'shareClientLink'))) return Response.json({ ok: false, error: 'You cannot share client links.' }, { status: 403 });
      const r = await loadReview(slug, week);
      if (!r.shipGate) return Response.json({ ok: false, error: 'Sign the ship gate before sharing with the client.' });
      const token = r.clientToken || (globalThis.crypto.randomUUID().replace(/-/g, '') + globalThis.crypto.randomUUID().replace(/-/g, '')).slice(0, 24);
      await c.patch(id).set({ clientToken: token, sharedAt: r.sharedAt || now }).commit();
      await log(who, r.clientToken ? 'Reopened the client link' : 'Created the client link', id, '');
    }

    else if (action === 'revoke') {
      if ((await can(who, 'shareClientLink')) !== 'yes') return Response.json({ ok: false, error: 'You cannot revoke client links.' }, { status: 403 });
      await c.patch(id).set({ clientToken: null }).commit();
      await log(who, 'Revoked the client link', id, '');
    }

    else if (action === 'unship') {
      if (!p.canShip) return Response.json({ ok: false, error: 'You cannot reopen this week.' }, { status: 403 });
      await c.patch(id).set({ shipGate: null }).commit();
      await log(who, 'Reopened the week after shipping', id, '');
    }

    else return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

    const review = await loadReview(slug, week);
    return Response.json({ ok: true, perms: p, project: w.project, source: w.source, tab: w.tab, sheetTitle: w.sheetTitle, ...shape(review, week, w.items) });
  } catch (e) {
    return Response.json({ ok: false, error: (e.message || String(e)).slice(0, 220) });
  }
}
