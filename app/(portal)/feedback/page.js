import { sanity } from '../../../lib/sanity';
import { meSlug } from '../../../lib/me';
import { pageAllowed } from '../../../lib/guard';
import NotYours from '../../../components/NotYours';
import { can } from '../../../lib/perm';
import FeedbackBoard from '../../../components/FeedbackBoard';

export const dynamic = 'force-dynamic';

export default async function Feedback() {
  const who = meSlug();
  if (!pageAllowed(who, '/feedback')) return <NotYours what="Client feedback" />;

  let weeks = [], work = [], candidates = [], error = null;
  try {
    weeks = await sanity(true).fetch(
      `*[_type=="weekReview" && count(clientDecisions[decision=="changes"]) > 0]|order(week desc)[0...40]{
        week, projectSlug, clientDecisions, flags,
        "projectName": project->name, "client": project->client->name, "clientSlug": project->client->slug }`);
    work = await sanity(true).fetch(
      `*[_type=="work" && count(feedback) > 0]|order(_createdAt desc)[0...100]{
        _id, title, kind, state, feedback, driveLink, "projectSlug": project->slug,
        "projectName": project->name, "client": project->client->name, "clientSlug": project->client->slug,
        "assigneeName": assignee->name }`);
    candidates = await sanity(true).fetch(
      `*[_type=="work" && state=="client"]|order(due asc)[0...100]{
        _id,title,"projectName":project->name,"client":project->client->name}`);
  } catch (e) { error = e.message; }
  const canTriage = ['yes', 'oversight'].includes(can(who, 'triageFeedback')) || ['himanshu', 'aashif'].includes(who);

  return (
    <>
      {error ? <div className="alert">Sanity did not answer. <code>{error}</code></div> : null}
      <FeedbackBoard weeks={weeks} work={work} candidates={candidates} canTriage={canTriage} />
    </>
  );
}
