import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { can } from '../../../lib/perm';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import BrandList from '../../../components/BrandList';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const who = meSlug();
  if (!pageAllowed(who, '/brand')) return <NotYours what="Brand brain" />;

  const shade = can(who, 'approveBrand');
  const canEdit = shade !== 'no' && !!shade;

  let clients = [], error = null;
  try {
    clients = await sanity(true).fetch(
      `*[_type=="client" && active != false]|order(name asc){
        slug, name, brand,
        "projects": *[_type=="project" && references(^._id)]|order(name asc){name,type}
      }`);
  } catch (e) { error = e.message; }

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">How every client sounds and looks</div>
          <h1>Brand brain</h1>
          <p className="lede">
            Positioning, voice, what to never say and the visual direction, kept per client rather than
            typed again for every project. Every project under a client reads the same one. Upload a
            brief or paste a Drive link and the fields are proposed from it. Nothing changes until you
            pick or merge each one.
          </p>
        </div>
      </div>
      {error ? <div className="alertbar">Sanity did not answer. <code>{error}</code></div> : null}
      {!canEdit ? <div className="pad note" style={{ marginBottom: 14 }}>
        Priyanka and Gowtham (SEO clients) keep this current day to day. You can read every field here,
        but saving needs one of them, or Himanshu or Aashif as the exception.
      </div> : null}
      <BrandList clients={clients} canEdit={canEdit} openSlug={searchParams?.client || ''} />
      {!clients.length && !error ? <div className="panel"><div className="pad note">No clients yet.</div></div> : null}
    </>
  );
}
