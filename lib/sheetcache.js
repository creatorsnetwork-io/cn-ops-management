import { listSheetTabs, readSheetWithLinks } from './google';

// Every project page was opening the real sheets on every load, which is why they
// felt slow. Reading a Liberty tab is 342 rows of grid data over the network.
//
// This holds the last read in memory for a short while. It is deliberately short:
// the whole point of the portal is that the sheet is the truth, so a stale read
// would be worse than a slow one. Anything that needs certainty passes force.
const TTL = 90 * 1000;
const TAB_TTL = 10 * 60 * 1000;

const rowsCache = new Map();
const tabsCache = new Map();

function get(map, key, ttl) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) { map.delete(key); return null; }
  return hit;
}

export async function tabsOf(sheetId, force) {
  const k = sheetId;
  if (!force) {
    const hit = get(tabsCache, k, TAB_TTL);
    if (hit) return { ...hit.value, cached: true, at: hit.at };
  }
  const value = await listSheetTabs(sheetId);
  tabsCache.set(k, { at: Date.now(), value });
  return { ...value, cached: false, at: Date.now() };
}

export async function rowsOf(sheetId, tab, force) {
  const k = sheetId + '|' + (tab || '');
  if (!force) {
    const hit = get(rowsCache, k, TTL);
    if (hit) return { rows: hit.value, cached: true, at: hit.at };
  }
  const value = await readSheetWithLinks(sheetId, tab);
  rowsCache.set(k, { at: Date.now(), value });
  return { rows: value, cached: false, at: Date.now() };
}

// Called after a write, so the next read cannot show what was there before it.
export function forget(sheetId, tab) {
  if (tab) rowsCache.delete(sheetId + '|' + tab);
  else for (const k of [...rowsCache.keys()]) if (k.startsWith(sheetId + '|')) rowsCache.delete(k);
}

export function ageOf(sheetId, tab) {
  const hit = rowsCache.get(sheetId + '|' + (tab || ''));
  return hit ? Date.now() - hit.at : null;
}

// Documents that change rarely but get fetched on every request. Sanity is a
// round trip each time, and four of those is most of a slow page.
const docs = new Map();
export async function cachedDoc(key, ttl, fn) {
  const hit = docs.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await fn();
  docs.set(key, { at: Date.now(), value });
  return value;
}
export function forgetDoc(prefix) {
  for (const k of [...docs.keys()]) if (k.startsWith(prefix)) docs.delete(k);
}
