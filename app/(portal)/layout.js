import { redirect } from 'next/navigation';
import Shell from '../../components/Shell';
import { navFor } from '../../lib/perm';
import { me, meSlug } from '../../lib/me';
import { badgesFor } from '../../lib/badges';
import { buildSearchIndex } from './search';

export default async function PortalLayout({ children }) {
  if (!meSlug()) redirect('/signin');

  let who = { slug: 'himanshu', all: [], person: { name: 'Himanshu Arora', role: 'Founder' }, how: 'testing' };
  let error = null;
  try { who = await me(); } catch (e) { error = e.message; }

  const allowedGroups = navFor(who.slug);
  const visibleHrefs = new Set(allowedGroups.flatMap((g) => g.items.map((i) => i.href)));
  let searchItems = [], searchError = '';
  const [counts, search] = await Promise.all([
    badgesFor(who.slug),
    buildSearchIndex(who.slug, visibleHrefs)
      .then((items) => ({ items, error: '' }))
      .catch((e) => ({ items: [], error: (e.message || String(e)).slice(0, 160) })),
  ]);
  searchItems = search.items;
  searchError = search.error;

  const groups = allowedGroups.map((g) => ({
    g: g.g,
    items: g.items.map((i) => ({ ...i, count: counts[i.href] || 0, hot: !!counts[i.href + '!'] })),
  }));
  const system = groups.find((g) => g.g === 'System');
  if (system) system.items.push({ href: '/mobile', l: 'Mobile screens', count: 0, hot: false });
  else groups.push({ g: 'System', items: [{ href: '/mobile', l: 'Mobile screens', count: 0, hot: false }] });

  return (
    <Shell
      groups={groups}
      who={{ slug: who.slug, all: who.all, how: who.how, name: who.person?.name, role: who.person?.role }}
      search={{ items: searchItems, error: searchError }}
    >
      {error ? (
        <div className="alert">
          Cannot read the team from Sanity yet. <code>{error}</code><br />
          Check <a href="/setup">Connections</a>, then run <code>npm run seed</code>.
        </div>
      ) : null}
      {children}
    </Shell>
  );
}
