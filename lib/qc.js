// Deterministic quality checks. No AI here on purpose: these are the rules that
// must never be a matter of opinion, so they run the same way every time.
// The AI pass sits on top of this and can only advise, never block.

const LIMITS = [
  [['instagram', 'ig', 'insta'], 2200, [3, 12]],
  [['x', 'twitter'], 280, [0, 3]],
  [['linkedin', 'linkedinn', 'li'], 3000, [0, 5]],
  [['facebook', 'fb'], 5000, [0, 6]],
  [['threads'], 500, [0, 5]],
];

export const BANNED = [
  'excited to share', 'excited to announce', 'humbled and honoured', 'humbled and honored',
  'humbly announcing', 'game-changer', 'game changer', 'disruptive', 'synergy',
  'in today’s fast-paced', "in today's fast-paced", 'deliver results', 'leverage our',
  'unlock the power', 'take it to the next level', 'best-in-class', 'thrilled to announce',
];

// Limits can be edited in Settings. Anything not overridden falls back to these.
function limitFor(channel, overrides) {
  const n = String(channel || '').toLowerCase().replace(/[^a-z]/g, '');
  if (overrides) {
    for (const o of overrides) {
      const k = String(o.channel || '').toLowerCase().replace(/[^a-z]/g, '');
      if (k && (n === k || n.startsWith(k))) return { chars: +o.chars || 0, tags: [+o.tagsMin || 0, +o.tagsMax || 99] };
    }
  }
  for (const [names, chars, tags] of LIMITS) if (names.some((w) => n === w || n.startsWith(w))) return { chars, tags };
  return null;
}
const hashtags = (t) => (String(t || '').match(/#[\wÀ-ɏ]+/g) || []);


// If a row says which channel it is for, only that channel's caption is expected.
// "LinkedIn only" should not raise three flags about empty Instagram copy.
const CH_ALIAS = {
  instagram: ['instagram', 'insta', 'ig'],
  facebook: ['facebook', 'fb'],
  linkedin: ['linkedin', 'linkedinn'],
  x: ['twitter'],
  threads: ['threads'],
  youtube: ['youtube', 'yt'],
  tiktok: ['tiktok'],
};
function channelKey(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  for (const k of Object.keys(CH_ALIAS)) if (k === n || CH_ALIAS[k].includes(n)) return k;
  return n;
}
function intendedChannels(i) {
  const hay = ' ' + [i.type, i.channel, (i.channels || []).join(' '), i.title].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  const found = [];
  for (const k of Object.keys(CH_ALIAS)) {
    for (const w of [k].concat(CH_ALIAS[k])) {
      if (hay.includes(' ' + w + ' ')) { found.push(k); break; }
    }
  }
  return found;
}

// severity: 'block' stops the ship gate, 'warn' is visible but does not stop it
function flag(key, severity, code, message, channel) {
  return { key, severity, code, message, channel: channel || '' };
}

// A waiver says "this is not required". Either for one row, or as a standing rule
// for a kind of post on a project. Rules are written by the team, not by me.
function waivedBy(f, item, waivers, rules) {
  for (const w of waivers || []) {
    if (w.key === f.key && w.code === f.code && (!w.channel || w.channel === f.channel)) return w;
  }
  const type = String(item.type || '').trim().toLowerCase();
  for (const r of rules || []) {
    if (r.code !== f.code) continue;
    if (r.channel && r.channel !== f.channel) continue;
    if (String(r.postType || '').trim().toLowerCase() !== type) continue;
    return r;
  }
  return null;
}

export function runChecks(items, opts) {
  const o = opts || {};
  const waivers = o.waivers || [];
  const rules = o.rules || [];
  const today = o.today || new Date().toISOString().slice(0, 10);
  const banned = BANNED.concat(o.extraBanned || []);
  const out = [];
  const seen = {};

  for (const i of items) {
    const key = i.key;

    if (!i.hasCreative) out.push(flag(key, 'block', 'no-creative', 'No creative in the sheet.'));
    else if (!i.creativeLink) out.push(flag(key, 'warn', 'no-link', 'The creative cell has text but no link behind it.'));

    if (!i.hasCaption) out.push(flag(key, 'block', 'no-caption', 'Nothing written in any caption column.'));

    const intended = intendedChannels(i);
    for (const c of i.captions || []) {
      const where = c.channel;
      const ck = channelKey(where);
      const expected = !intended.length || intended.includes(ck);
      if (!c.has) {
        if (expected) out.push(flag(key, 'warn', 'channel-empty', where + ' caption is empty.', where));
        continue;
      }
      const t = c.text;

      const lim = limitFor(where, o.limits);
      if (lim && t.length > lim.chars)
        out.push(flag(key, 'block', 'too-long', where + ' is ' + t.length + ' characters, the limit is ' + lim.chars + '.', where));

      if (lim) {
        const n = hashtags(t).length;
        if (n > lim.tags[1]) out.push(flag(key, 'warn', 'hashtags-high', where + ' has ' + n + ' hashtags, keep it to ' + lim.tags[1] + '.', where));
        if (n < lim.tags[0]) out.push(flag(key, 'warn', 'hashtags-low', where + ' has ' + n + ' hashtags, it usually wants at least ' + lim.tags[0] + '.', where));
      }

      const low = t.toLowerCase();
      for (const b of banned) if (low.includes(b)) out.push(flag(key, 'warn', 'banned', where + ' contains "' + b + '".', where));

      if (t.includes('—')) out.push(flag(key, 'warn', 'em-dash', where + ' uses an em dash. House rule is commas, colons or a new line.', where));
      if (/ {2,}/.test(t)) out.push(flag(key, 'warn', 'double-space', where + ' has a double space.', where));
      if (/\bTBD\b|\bTODO\b|\bXXX\b|\blorem\b/i.test(t)) out.push(flag(key, 'block', 'placeholder', where + ' still has placeholder text in it.', where));
      const opens = (t.match(/[([{]/g) || []).length, closes = (t.match(/[)\]}]/g) || []).length;
      if (opens !== closes) out.push(flag(key, 'warn', 'brackets', where + ' has unmatched brackets.', where));

      const fp = low.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (fp.length > 40) {
        if (seen[fp] && seen[fp] !== key) out.push(flag(key, 'warn', 'duplicate', where + ' repeats a caption already used on ' + seen[fp] + '.', where));
        else seen[fp] = key;
      }
    }

    if (i.date && i.date < today && i.pending)
      out.push(flag(key, 'block', 'overdue', 'Publish date has passed and this is still incomplete.'));
  }

  // Nothing is deleted. A waived flag stays visible, says who waived it, and
  // stops counting against the gate. Hiding it would hide the decision too.
  const byKey = {};
  for (const i of items) byKey[i.key] = i;
  return out.map((f) => {
    const w = waivedBy(f, byKey[f.key] || {}, waivers, rules);
    return w ? { ...f, waived: true, waivedBy: w.by || '', waivedScope: w.postType ? 'rule' : 'once' } : f;
  });
}

export function blocking(flags) {
  return (flags || []).filter((f) => f.severity === 'block' && !f.waived);
}
export function byItem(flags) {
  const m = {};
  for (const f of flags || []) (m[f.key] = m[f.key] || []).push(f);
  return m;
}
