'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function shiftWeek(w, n) {
  const d = new Date(w + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}
function pretty(w) {
  const a = new Date(w + 'T00:00:00Z'), b = new Date(w + 'T00:00:00Z');
  b.setUTCDate(b.getUTCDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return f(a) + ' to ' + f(b);
}

export default function WeekBoard({ startWeek }) {
  const [week, setWeek] = useState(startWeek);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;
    setD(null); setErr(null);
    fetch('/api/week?week=' + week)
      .then((r) => r.json())
      .then((j) => { if (!live) return; j.ok ? setD(j) : setErr(j.error || 'Could not read the calendars.'); })
      .catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [week]);

  return (
    <>
      <div className="panel">
        <header>
          <h2>Week of {pretty(week)}</h2>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={() => setWeek(shiftWeek(week, -1))}>Previous</button>
            <button className="btn sm" onClick={() => setWeek(startWeek)}>This week</button>
            <button className="btn sm" onClick={() => setWeek(shiftWeek(week, 1))}>Next</button>
          </span>
        </header>

        {!d && !err ? <div className="empty">Reading the calendar sheets, this takes a few seconds.</div> : null}
        {err ? <div className="row"><span className="dot no" /><div className="t"><b>Could not read the calendars</b><span className="err">{err}</span></div></div> : null}

        {d ? (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line2)' }}>
              <div className="stat">
                <div><b>{d.totals.total}</b><span>posts this week</span></div>
                <div><b>{d.totals.ready}</b><span>complete</span></div>
                <div><b style={{ color: d.totals.pending ? 'var(--bad)' : 'var(--ok)' }}>{d.totals.pending}</b><span>pending</span></div>
              </div>
            </div>
            <table className="tbl">
              <thead><tr><th>Project</th><th>Calendar</th><th>Posts</th><th>Pending</th><th>What is missing</th></tr></thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i}>
                    <td><Link href={'/projects/' + r.slug}>{r.name}</Link><div style={{ color: 'var(--faint)', fontSize: 12 }}>{r.owner || 'no owner set'}</div></td>
                    <td>{r.ok ? <>{r.source}<div style={{ color: 'var(--faint)', fontSize: 12 }}>tab: {r.tab}</div></> : <span className="tag no">not readable</span>}</td>
                    <td>{r.ok ? r.summary.total : '—'}</td>
                    <td>{r.ok ? (r.summary.pending ? <span className="tag bad">{r.summary.pending}</span> : <span className="tag ok">clear</span>) : '—'}</td>
                    <td>
                      {!r.ok ? <span style={{ color: 'var(--bad)' }}>{r.error}</span>
                        : r.gaps.length === 0 ? <span style={{ color: 'var(--faint)' }}>Nothing outstanding</span>
                        : r.gaps.slice(0, 6).map((g, j) => (
                            <div key={j} style={{ marginBottom: 3 }}>
                              <span className="mono" style={{ color: 'var(--muted)' }}>{g.date || '?'}</span>{' '}
                              {g.channel ? g.channel + ', ' : ''}{g.type || g.title || 'post'}{' '}
                              <span className="tag warn">no {g.missing.join(' and no ')}</span>
                            </div>
                          ))}
                      {r.ok && r.gaps.length > 6 ? <div style={{ color: 'var(--faint)' }}>and {r.gaps.length - 6} more</div> : null}
                    </td>
                  </tr>
                ))}
                {d.rows.length === 0 ? <tr><td colSpan={5} className="empty">No active social projects in Sanity yet. Run <code>npm run seed</code>.</td></tr> : null}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
      <p className="note">
        Pending means the caption cell or the creative cell is empty for that row, read live from the sheet.
        Nothing here is typed in twice. If a project says not readable, the sheet is not shared with the
        service account or the calendar link on the project is wrong.
      </p>
    </>
  );
}
