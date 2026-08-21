import { meSlug } from '../../../../lib/me';
import { pageAllowed } from '../../../../lib/guard';
import NotYours from '../../../../components/NotYours';
import ProspectDetail from '../../../../components/ProspectDetail';

export const dynamic = 'force-dynamic';

export default function ProspectPage({ params }) {
  if (!pageAllowed(meSlug(), '/pipeline')) return <NotYours what="Pipeline" />;
  return <ProspectDetail id={decodeURIComponent(params.id)} />;
}
