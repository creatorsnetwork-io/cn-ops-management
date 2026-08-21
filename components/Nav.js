'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav({ groups }) {
  const path = usePathname();
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav>
      {groups.map((g) => (
        <div key={g.g}>
          <div className="grp">{g.g}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={'nv' + (active(i.href) ? ' on' : '')}>
              <span>{i.l}</span>
              {i.count ? <em className={'navcount' + (i.hot ? ' hot' : '')}>{i.count}</em> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
