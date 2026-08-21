import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import PipelineV7 from '../../../components/PipelineV7';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!pageAllowed(meSlug(), '/pipeline')) return <NotYours what="Pipeline" />;
  let people = [];
  try { people = await sanity(true).fetch('*[_type=="person" && active==true]|order(name asc){slug,name}'); } catch (e) {}

  return (
    <PipelineV7 people={people} />
  );
}
