'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav({ groups }) {
  const path = usePathname();
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="navwrap">
      {groups.map((g) => (
        <div className="grp" key={g.g}>
          <div className="lbl">{g.g}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={'nav' + (active(i.href) ? ' on' : '')}>
              <span>{i.l}</span>
              {i.count ? <span className={'pill' + (i.hot ? ' hot' : '')}>{i.count}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
