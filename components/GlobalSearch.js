'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const normal = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

function score(item, query) {
  const title = normal(item.title);
  const all = normal([item.title, item.meta, item.terms, item.kind].join(' '));
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (all.includes(query)) return 3;
  return 99;
}

export default function GlobalSearch({ items, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  const results = useMemo(() => {
    const q = normal(query);
    const source = q ? items : items.filter((i) => ['Client', 'Project', 'Archived'].includes(i.kind));
    return source.map((item, order) => ({ item, order, rank: q ? score(item, q) : 0 }))
      .filter((x) => x.rank < 99)
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, 14).map((x) => x.item);
  }, [items, query]);

  function show() {
    setQuery(''); setActive(0); setOpen(true);
  }

  function close() {
    setOpen(false); setQuery(''); setActive(0);
  }

  useEffect(() => {
    function keys(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); show();
      } else if (e.key === 'Escape' && open) {
        e.preventDefault(); close();
      }
    }
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => input.current?.focus());
    return () => { document.body.style.overflow = before; };
  }, [open]);

  useEffect(() => { close(); }, [pathname]);
  useEffect(() => { setActive(0); }, [query]);

  function inputKeys(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setActive((n) => results.length ? (n + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActive((n) => results.length ? (n - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault(); router.push(results[active].href); close();
    }
  }

  return (
    <>
      <button className="searchbtn" type="button" onClick={show} aria-label="Search CN Ops">
        <span>Search</span><kbd>⌘K</kbd>
      </button>
      <div className={'sov' + (open ? ' on' : '')} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="sbox" role="dialog" aria-modal="true" aria-label="Search CN Ops">
          <div className="rowb" style={{ alignItems: 'center', borderBottom: '1px solid var(--line2)', flexWrap: 'nowrap' }}>
            <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={inputKeys}
              placeholder="Search clients, projects, work, captions, feedback" autoComplete="off" />
            <button className="btn sm" type="button" onClick={close} aria-label="Close search">Close</button>
          </div>
          <div className="sres" role="listbox" aria-label="Search results">
            {error ? <div className="sr"><div className="m" style={{ padding: '4px 0' }}>Search could not read Sanity. {error}</div></div> : null}
            {!error && results.map((r, i) => (
              <Link href={r.href} className={'sr' + (i === active ? ' on' : '')} key={r.kind + r.href + i}
                role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={close}>
                <div className="k">{r.kind}</div>
                <div className="t">{r.title}<div className="m">{r.meta}</div></div>
              </Link>
            ))}
            {!error && !results.length ? <div className="sr"><div className="m" style={{ padding: '4px 0' }}>Nothing found</div></div> : null}
          </div>
          <div className="note" style={{ display: 'flex', gap: 16, padding: '9px 18px', borderTop: '1px solid var(--line2)' }}><span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>
        </div>
      </div>
    </>
  );
}
