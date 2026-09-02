'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Who({ how, name, role }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function out() {
    await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });
    window.location.href = '/signin';
  }

  return (
    <div className="whowrap" ref={wrap}>
      <button className="whobtn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <span className="crumb"><b>{name}</b>{role ? <> / {role}</> : null}</span>
        <span className="av" title={[name, role].filter(Boolean).join(', ')}>{initials(name)}</span>
      </button>
      {open ? (
        <div className="whodrop">
          <Link className="whoitem" href="/guide" onClick={() => setOpen(false)}>User guide</Link>
          {how === 'testing' ? <a className="whoitem" href="/signin" onClick={() => setOpen(false)}>Sign in properly</a> : null}
          <button className="whoitem" onClick={out}>Sign out</button>
        </div>
      ) : null}
    </div>
  );
}
