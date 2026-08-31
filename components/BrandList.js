'use client';
import { useEffect, useRef, useState } from 'react';
import BrandBrain from './BrandBrain';

function filledCount(b) {
  if (!b) return 0;
  let n = 0;
  if (String(b.positioning || '').trim()) n++;
  if (String(b.visual || '').trim()) n++;
  if ((b.voiceIs || []).length) n++;
  if ((b.voiceIsNot || []).length) n++;
  if ((b.neverSay || []).length) n++;
  if ((b.always || []).length) n++;
  return n;
}

// A search box and a list of collapsible client cards, so this stays usable
// once every client has one of these rather than six open panels to scroll past.
export default function BrandList({ clients, canEdit, openSlug }) {
  const [q, setQ] = useState('');
  const [openSet, setOpenSet] = useState(() => new Set(openSlug ? [openSlug] : []));
  const refs = useRef({});

  useEffect(() => {
    if (openSlug && refs.current[openSlug]) {
      refs.current[openSlug].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [openSlug]);

  const needle = q.trim().toLowerCase();
  const shown = clients.filter((c) => !needle
    || c.name.toLowerCase().includes(needle)
    || (c.projects || []).some((p) => p.name.toLowerCase().includes(needle)));

  function toggle(slug) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  return (
    <>
      <div className="filters" style={{ marginBottom: 10 }}>
        <div className="sbox" style={{ flex: '1 1 320px', maxWidth: 470, border: '1px solid var(--line)' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients or projects" autoComplete="off" />
        </div>
        <span className="note" style={{ margin: 0 }}>
          {shown.length} of {clients.length} client{clients.length === 1 ? '' : 's'}
          {openSet.size ? ', ' + openSet.size + ' open' : ''}
        </span>
        {shown.length > 1 ? <button className="btn sm" onClick={() => setOpenSet(new Set())}>Collapse all</button> : null}
      </div>

      {shown.length === 0 ? <div className="panel"><div className="pad note">No client matches "{q}".</div></div> : null}

      {shown.map((c) => (
        <div key={c.slug} ref={(el) => { refs.current[c.slug] = el; }}>
          <BrandBrain client={c} canEdit={canEdit} filled={filledCount(c.brand)}
            open={openSet.has(c.slug)} onToggle={() => toggle(c.slug)} />
        </div>
      ))}
    </>
  );
}
