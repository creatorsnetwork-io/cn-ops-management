'use client';
import { useState } from 'react';
import Link from 'next/link';
import Nav from './Nav';
import Who from './Who';
import Breadcrumbs from './Breadcrumbs';
import GlobalSearch from './GlobalSearch';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Shell({ groups, who, search, children }) {
  const [open, setOpen] = useState(false);
  const canOpenJobs = groups.some((g) => g.items.some((i) => i.href === '/jobs'));
  const jobStatus = <><i aria-hidden="true" /><div><b>Jobs healthy</b><span>Digest 08:01</span></div></>;

  return (
    <div className={'shell' + (open ? ' on' : '')}>
      <div className={'scrim' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <aside className="side" onClick={() => setOpen(false)}>
        <div className="brand"><img className="cnlogo" src="/cn-logo.png" alt="Creators Network" /></div>
        <Nav groups={groups} />
        {canOpenJobs
          ? <Link className="sysbar" href="/jobs">{jobStatus}</Link>
          : <div className="sysbar">{jobStatus}</div>}
      </aside>
      <div>
        <div className="top">
          <button className="btn sm" onClick={() => setOpen(!open)} aria-label="Menu">Menu</button>
          <div className="crumb"><Breadcrumbs index={search.items} /></div>
          <GlobalSearch items={search.items} error={search.error} />
          <div className="whobox">
            <Who how={who.how} name={who.name} role={who.role} />
            <div className="av" title={[who.name, who.role].filter(Boolean).join(', ')}>{initials(who.name)}</div>
          </div>
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
