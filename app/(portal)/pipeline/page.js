import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import Pipeline from '../../../components/Pipeline';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!pageAllowed(meSlug(), '/pipeline')) return <NotYours what="Pipeline" />;
  let people = [];
  try { people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'); } catch (e) {}

  return (
    <>
      <div className="eyebrow">Founder</div>
      <h1>Pipeline</h1>
      <p className="lede">New business, mostly Dubai. This is the screen that has to fill before Liberty leaves.</p>
      <Pipeline people={people} />
    </>
  );
}
