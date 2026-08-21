import { sanity } from '../../../lib/sanity';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import CalendarHub from '../../../components/CalendarHub';

export const dynamic = 'force-dynamic';

export default async function CalendarIndex({ searchParams }) {
  const who = meSlug();
  if (!pageAllowed(who, '/calendar')) return <NotYours what="Calendar tracker" />;

  let rows = [], error = null;
  try {
    rows = await sanity(true).fetch(
      `*[_type=="project" && type=="social"]|order(name asc){slug,name,"client":client->name,calendarSources}`
    );
  } catch (e) { error = e.message; }

  return (
    <>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <CalendarHub projects={rows} defaultSlug={searchParams && searchParams.project}
        canShare={can(who, 'shareClientLink') === 'yes'} />
    </>
  );
}
