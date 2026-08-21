'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TOP = {
  '/': 'Home', '/clients': 'Clients', '/projects': 'Projects', '/work': 'Work',
  '/calendar': 'Calendar tracker', '/qc': 'QC flags', '/feedback': 'Client feedback',
  '/requests': 'Requests', '/reports': 'Reports', '/links': 'Client links',
  '/archive': 'Archive', '/escalations': 'Escalations', '/pipeline': 'Pipeline',
  '/team': 'Team and capacity', '/vendors': 'Vendors and freelancers',
  '/jobs': 'Job health', '/settings': 'Settings', '/setup': 'Connections',
};

const PROJECT_CHILD = {
  calendar: 'Calendar tracker', review: 'Weekly review', count: 'Count',
  prd: 'Working document', pack: 'Record of approvals',
};

const fallback = (value) => decodeURIComponent(value || '')
  .replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function exact(index, href, kinds) {
  return index.find((i) => i.href === href && (!kinds || kinds.includes(i.kind)));
}

function crumbsFor(pathname, index) {
  const path = pathname !== '/' ? pathname.replace(/\/$/, '') : '/';
  if (TOP[path]) return [{ label: TOP[path] }];

  const bits = path.split('/').filter(Boolean);
  if (bits[0] === 'clients' && bits[1]) {
    const href = '/clients/' + bits[1];
    const item = exact(index, href, ['Client']);
    return [{ label: 'Clients', href: '/clients' }, { label: item?.title || fallback(bits[1]) }];
  }

  if (bits[0] === 'projects' && bits[1]) {
    const href = '/projects/' + bits[1];
    const item = exact(index, href, ['Project', 'Archived']);
    const out = [{ label: 'Projects', href: '/projects' }];
    if (item?.parentLabel) out.push({ label: item.parentLabel, href: item.parentHref || null });
    out.push({ label: item?.title || fallback(bits[1]), href: bits[2] ? href : null });
    if (bits[2]) out.push({ label: PROJECT_CHILD[bits[2]] || fallback(bits[2]) });
    return out;
  }

  if (bits[0] === 'work' && bits[1]) {
    const href = '/work/' + bits[1];
    const item = exact(index, href, ['Work item']);
    const out = [{ label: 'Work', href: '/work' }];
    if (item?.parentLabel) out.push({ label: item.parentLabel, href: item.parentHref || null });
    out.push({ label: item?.title || 'Work item' });
    return out;
  }

  const parent = '/' + (bits[0] || '');
  return [{ label: TOP[parent] || fallback(bits[0]) }, ...bits.slice(1).map((b) => ({ label: fallback(b) }))];
}

export default function Breadcrumbs({ index }) {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname, index || []);

  return (
    <nav aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={i}>
          {i ? <span aria-hidden="true"> / </span> : null}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <b aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</b>}
        </Fragment>
      ))}
    </nav>
  );
}
