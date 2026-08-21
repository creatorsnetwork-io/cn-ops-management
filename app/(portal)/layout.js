import { redirect } from 'next/navigation';
import Shell from '../../components/Shell';
import { navFor } from '../../lib/perm';
import { me, meSlug } from '../../lib/me';
import { badgesFor } from '../../lib/badges';

export default async function PortalLayout({ children }) {
  if (!meSlug()) redirect('/signin');

  let who = { slug: 'himanshu', all: [], person: { name: 'Himanshu Arora', role: 'Founder' }, how: 'testing' };
  let error = null;
  try { who = await me(); } catch (e) { error = e.message; }

  const counts = await badgesFor(who.slug);
  const groups = navFor(who.slug).map((g) => ({
    g: g.g,
    items: g.items.map((i) => ({ ...i, count: counts[i.href] || 0, hot: !!counts[i.href + '!'] })),
  }));

  return (
    <Shell
      groups={groups}
      who={{ slug: who.slug, all: who.all, how: who.how, name: who.person?.name, role: who.person?.role }}
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
