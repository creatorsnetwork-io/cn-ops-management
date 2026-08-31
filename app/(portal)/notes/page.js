import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import MeetingNotes from '../../../components/MeetingNotes';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const who = meSlug();
  if (!(await pageAllowed(who, '/notes'))) return <NotYours what="Meeting notes" />;
  return <MeetingNotes />;
}
