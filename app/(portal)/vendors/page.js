import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import Vendors from '../../../components/Vendors';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!pageAllowed(meSlug(), '/vendors')) return <NotYours what="Vendors and freelancers" />;
  return (
    <>
      <div className="eyebrow">System</div>
      <h1>Vendors and freelancers</h1>
      <p className="lede">
        Who we use, what they cost, and how often their work has to be done again.
      </p>
      <Vendors />
    </>
  );
}
