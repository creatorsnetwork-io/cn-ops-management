import Link from 'next/link';
import { sanity } from '../../../lib/sanity';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { meSlug } from '../../../lib/me';

export const dynamic = 'force-dynamic';

export default async function CalendarIndex() {
  if (!pageAllowed(meSlug(), '/calendar')) return <NotYours what="Calendar tracker" />;

  let rows = [], error = null;
  try {
    rows = await sanity(true).fetch(
      `*[_type=="project" && type=="social"]|order(name asc){slug,name,"client":client->name,calendarSources}`
    );
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="eyebrow">Quality</div>
      <h1>Calendar tracker</h1>
      <p className="lede">
        The calendars stay in Google Sheets exactly as they are. This reads them and tells you what is missing.
      </p>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <div className="panel">
        <table className="tbl">
          <thead><tr><th>Project</th><th>Client</th><th>Calendars linked</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug}>
                <td><b>{p.name}</b></td>
                <td>{p.client}</td>
                <td>{(p.calendarSources || []).length
                  ? (p.calendarSources || []).map((c) => <div key={c._key}>{c.label}{c.current ? '' : ' (old)'}</div>)
                  : <span className="tag warn">none</span>}</td>
                <td><Link className="btn sm" href={'/projects/' + p.slug + '/calendar'}>Open</Link></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={4} className="empty">No social projects yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
