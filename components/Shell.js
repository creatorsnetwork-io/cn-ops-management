'use client';
import { useState } from 'react';
import Nav from './Nav';
import Who from './Who';

export default function Shell({ groups, who, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={'shell' + (open ? ' navOpen' : '')}>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside className="side" onClick={() => setOpen(false)}>
        <div className="brand"><img src="/cn-logo.png" alt="Creators Network" /></div>
        <Nav groups={groups} />
      </aside>
      <div className="main">
        <div className="top">
          <button className="menuBtn" onClick={() => setOpen(!open)} aria-label="Menu">Menu</button>
          <div className="crumb"><b>{who.name}</b>{who.role ? ', ' + who.role : ''}</div>
          {who.all && who.all.length ? <Who slug={who.slug} all={who.all} how={who.how} name={who.name} /> : null}
        </div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
