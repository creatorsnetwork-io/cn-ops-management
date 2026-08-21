import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import Settings from '../../../components/Settings';
import { BANNED } from '../../../lib/qc';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const LIMITS = [
  { name: 'Instagram', chars: '2,200', tags: '3 to 12' },
  { name: 'X', chars: '280', tags: '0 to 3' },
  { name: 'LinkedIn', chars: '3,000', tags: '0 to 5' },
  { name: 'Facebook', chars: '5,000', tags: '0 to 6' },
  { name: 'Threads', chars: '500', tags: '0 to 5' },
];

export default async function Page() {
  const who = meSlug();
  if (!pageAllowed(who, '/settings')) return <NotYours what="Settings" />;

  let house = { bannedPhrases: [], digestHour: 8 }, projects = [], error = null;
  try {
    const s = await sanity(true).fetch('*[_id=="settings.house"][0]{bannedPhrases,digestHour,limits}');
    if (s) house = s;
    projects = await sanity(true).fetch(
      '*[_type=="project"]|order(name asc){slug,name,type,voice,extraBanned,"client":client->name}');
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Standing rules</div>
          <h1>Settings</h1>
          <p className="lede">The rules the system applies automatically, plus the quality and voice controls already in use.</p>
        </div>
        <div className="rowb"><Link className="btn" href="/mobile">Mobile scope</Link><Link className="btn dark" href="/setup">Connections</Link></div>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      <Settings house={house} projects={projects} limits={LIMITS} builtIn={BANNED} canEdit={can(who, 'settings') === 'yes'} />
    </>
  );
}
