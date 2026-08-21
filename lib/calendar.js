// Reads a client content calendar sheet without asking anyone to change it.
// Every client's sheet is laid out slightly differently, so we work out the
// columns from the header row, show what we worked out, and let it be corrected.

const FIELDS = [
  ['date',     ['date','day','publish','posting','schedule']],
  ['channel',  ['platform','channel','network','social media','handle']],
  ['type',     ['type','format','post type','content type','asset type']],
  ['title',    ['idea','topic','title','concept','theme','subject','description','brief']],
  ['caption',  ['caption','copy','content','post copy','text','captions']],
  ['creative', ['creative link','creative','design','visual','post link','asset','file','artwork','image','video link','drive']],
  ['status',   ['status','stage','progress']],
  ['approval', ['approv','sign off','signoff','client ok']],
  ['remarks',  ['remark','note','comment','feedback','changes']],
];

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

// The header row is the first row near the top that looks like labels, not data.
export function findHeader(rows) {
  let best = { row: -1, hits: 0 };
  const limit = Math.min(rows.length, 15);
  for (let r = 0; r < limit; r++) {
    const cells = (rows[r] || []).map((c) => norm(c.text));
    let hits = 0;
    for (const [, words] of FIELDS) if (cells.some((c) => c && words.some((w) => c.includes(w)))) hits++;
    if (hits > best.hits) best = { row: r, hits };
  }
  return best.hits >= 3 ? best.row : -1;
}

export function mapColumns(headerCells) {
  const cells = headerCells.map((c) => norm(c.text));
  const used = new Set();
  const map = {};
  for (const [field, words] of FIELDS) {
    let pick = -1, pickScore = 0;
    cells.forEach((c, i) => {
      if (!c || used.has(i)) return;
      for (const w of words) {
        if (!c.includes(w)) continue;
        // an exact-ish header beats a header that merely contains the word
        const score = c === w ? 100 : 100 - Math.abs(c.length - w.length);
        if (score > pickScore) { pickScore = score; pick = i; }
      }
    });
    if (pick > -1) { map[field] = pick; used.add(pick); }
  }
  return map;
}

const CAPTION_WORDS = ['caption', 'copy', 'content', 'text'];
// Some clients name the column after the channel instead of writing "caption",
// for example a column simply headed "Instagram" or "Linkedinn".
const CHANNEL_LONG = ['instagram', 'facebook', 'linkedin', 'linkedinn', 'twitter', 'tiktok', 'youtube', 'threads', 'pinterest', 'snapchat', 'whatsapp'];
const CHANNEL_SHORT = ['ig', 'fb', 'li', 'yt', 'x', 'insta'];

// Columns holding written copy, one per channel where the client works that way.
export function captionColumns(headerCells, map) {
  const m = map || {};
  const taken = new Set(['date', 'type', 'title', 'creative', 'status', 'approval', 'remarks', 'channel']
    .map((f) => m[f]).filter((v) => v != null));
  const out = [];
  (headerCells || []).forEach((c, i) => {
    if (taken.has(i)) return;
    const n = norm(c.text);
    if (!n) return;
    const words = n.split(' ');
    const byWord = CAPTION_WORDS.some((w) => n.includes(w));
    const byChannel = !byWord && (CHANNEL_LONG.some((w) => n.includes(w)) || words.some((w) => CHANNEL_SHORT.includes(w)));
    if (!byWord && !byChannel) return;
    const channel = String(c.text || '')
      .replace(/captions?|copy|content|text/gi, '')
      .replace(/[:\-\u2013\u2014|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    out.push({ col: i, header: c.text, channel: channel || 'Caption', byChannel });
  });
  return out;
}

export function parseDate(text, fallbackYear) {
  const t = String(text || '').trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let a = +m[1], b = +m[2], c = +m[3];
    if (a > 31) return iso(a, b, c);                       // yyyy-mm-dd
    const yr = c < 100 ? 2000 + c : c;
    return b > 12 ? iso(yr, a, b) : iso(yr, b, a);         // dd/mm/yyyy, month second
  }
  m = t.match(/(\d{1,2})\s*[-\s]\s*([a-zA-Z]{3,})\s*[-\s]?\s*(\d{2,4})?/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) { const yr = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : fallbackYear; return iso(yr, mo, +m[1]); }
  }
  m = t.match(/([a-zA-Z]{3,})\s+(\d{1,2})(?:[,\s]+(\d{4}))?/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return iso(m[3] ? +m[3] : fallbackYear, mo, +m[2]);
  }
  const d = new Date(t);
  if (!isNaN(d.getTime()) && /\d/.test(t)) return d.toISOString().slice(0, 10);
  return null;
}
function iso(y, m, d) {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Monday of the week a date falls in, as yyyy-mm-dd.
export function weekStart(isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z');
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}
export function thisWeek(today) {
  return weekStart((today || new Date()).toISOString().slice(0, 10));
}

export function parseCalendar(rows, opts) {
  const o = opts || {};
  const headerRow = o.headerRow != null && o.headerRow > -1 ? o.headerRow : findHeader(rows);
  if (headerRow < 0) {
    return { ok: false, reason: 'Could not find a header row in the first 15 rows of this tab.', headerRow: -1, map: {}, items: [] };
  }
  const map = Object.keys(o.map || {}).length ? o.map : mapColumns(rows[headerRow] || []);
  const year = o.year || new Date().getFullYear();

  const cell = (row, field) => (map[field] == null ? { text: '', link: '' } : (row[map[field]] || { text: '', link: '' }));

  let capCols = captionColumns(rows[headerRow], map);

  // A column headed "Facebook" can be a caption or a yes/no tick.
  // Decide from what is actually in it: short values mean it is a tick.
  const flagCols = [];
  capCols = capCols.filter((cc) => {
    if (!cc.byChannel) return true;
    let filled = 0, longest = 0;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const t = (((rows[r] || [])[cc.col] || {}).text || '').trim();
      if (!t) continue;
      filled++;
      if (t.length > longest) longest = t.length;
    }
    if (filled >= 2 && longest <= 24) { flagCols.push(cc); return false; }
    return true;
  });

  if (!capCols.length && map.caption != null) {
    capCols = [{ col: map.caption, header: (rows[headerRow][map.caption] || {}).text || 'Caption', channel: 'Caption' }];
  }

  const items = [];
  let carryDate = null, carryChannel = '', blanks = 0;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const any = row.some((c) => c && c.text && c.text.trim());
    if (!any) { if (++blanks > 8) break; continue; }
    blanks = 0;

    const dRaw = cell(row, 'date').text;
    const d = parseDate(dRaw, year);
    if (d) carryDate = d;
    const ch = cell(row, 'channel').text.trim();
    if (ch) carryChannel = ch;

    const flags = flagCols.filter((fc) => (((row[fc.col] || {}).text || '').trim())).map((fc) => fc.channel);
    const caps = capCols.map((cc) => {
      const c = row[cc.col] || { text: '' };
      const t = (c.text || '').trim();
      return { channel: cc.channel, text: c.text || '', has: !!t, col: cc.col };
    });
    const caption  = { text: (caps.find((c) => c.has) || {}).text || '', link: '' };
    const creative = cell(row, 'creative');
    const title    = cell(row, 'title');
    const type     = cell(row, 'type');
    const status   = cell(row, 'status');
    const approval = cell(row, 'approval');
    const remarks  = cell(row, 'remarks');

    // A row with nothing but a date is a spacer, not a post.
    const substance = [caption.text, creative.text, title.text, type.text, status.text].some((t) => t && t.trim()) || caps.some((c) => c.has);
    if (!substance) continue;

    const hasCaption  = caps.length ? caps.some((c) => c.has) : !!(caption.text && caption.text.trim());
    const capMissing  = caps.filter((c) => !c.has).map((c) => c.channel);
    const hasCreative = !!(creative.text && creative.text.trim()) || !!creative.link;

    items.push({
      sheetRow: r + 1,
      date: carryDate,
      week: carryDate ? weekStart(carryDate) : null,
      dateRaw: dRaw,
      channel: carryChannel,
      type: type.text,
      title: title.text,
      caption: caption.text,
      captions: caps,
      channels: flags,
      capMissing,
      partial: hasCaption && capMissing.length > 0,
      creativeText: creative.text,
      creativeMime: creative.mimeType || '',
      creativeCol: map.creative != null ? map.creative : null,
      creativeLink: creative.link,
      creativeHow: creative.how || '',
      status: status.text,
      approval: approval.text,
      remarks: remarks.text,
      hasCaption,
      hasCreative,
      pending: !(hasCaption && hasCreative),
      missing: [!hasCaption && 'caption', !hasCreative && 'creative'].filter(Boolean),
    });
  }

  const mappedNames = {};
  for (const f of Object.keys(map)) mappedNames[f] = (rows[headerRow][map[f]] || {}).text || '';

  // Where do the links actually live? Useful when a Creative column looks full
  // but has no links behind the filenames.
  const linkCols = {};
  for (let r = headerRow + 1; r < rows.length; r++) {
    (rows[r] || []).forEach((c, i) => { if (c && c.link) linkCols[i] = (linkCols[i] || 0) + 1; });
  }
  const linkColumns = Object.keys(linkCols).map((i) => ({
    col: +i,
    header: ((rows[headerRow] || [])[+i] || {}).text || ('column ' + (+i + 1)),
    links: linkCols[i],
  })).sort((a, b) => b.links - a.links);

  return { ok: true, headerRow, map, mappedNames, captionCols: capCols, flagCols, linkColumns, items };
}

export function summarise(items, week) {
  const inWeek = week ? items.filter((i) => i.week === week) : items;
  return {
    week,
    total: inWeek.length,
    ready: inWeek.filter((i) => !i.pending).length,
    pending: inWeek.filter((i) => i.pending).length,
    noCaption: inWeek.filter((i) => !i.hasCaption).length,
    noCreative: inWeek.filter((i) => !i.hasCreative).length,
    noLink: inWeek.filter((i) => i.hasCreative && !i.creativeLink).length,
    partial: inWeek.filter((i) => i.partial).length,
  };
}

export function weeksOf(items) {
  const seen = {};
  for (const i of items) if (i.week) seen[i.week] = (seen[i.week] || 0) + 1;
  return Object.keys(seen).sort().map((w) => ({ week: w, count: seen[w] }));
}
