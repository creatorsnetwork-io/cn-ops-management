import { sanity } from './sanity';
import { cachedDoc } from './sheetcache';

// The numbers beside the sidebar items. Only things that are cheap to count are
// counted: nothing here opens a Google Sheet, because the sidebar renders on
// every single page and must never be the reason a page is slow.
export async function badgesFor(who) {
  const ops = ['himanshu', 'aashif'].includes(who);
  try {
    const r = await cachedDoc('badges:' + who, 30 * 1000, () => sanity(true).fetch(
      `{
        "blocking": count(*[_type=="weekReview" && count(flags[severity=="block"]) > 0 && !defined(shipGate.at)]),
        "feedback": count(*[_type=="weekReview" && count(clientDecisions[decision=="changes"]) > 0])
                  + count(*[_type=="work" && count(feedback[resolved != true]) > 0]),
        "requests": count(*[_type=="request" && state=="new"]),
        "escalations": count(*[_type=="escalation" && !defined(resolvedAt) ${ops ? '' : '&& (owner->slug == $who || raisedBy == $who)'}]),
        "mywork": count(*[_type=="work" && assignee->slug == $who && !(state in ["approved","done"])])
      }`, { who }));

    const out = {};
    if (r.blocking) { out['/qc'] = r.blocking; out['/qc!'] = true; }
    if (r.feedback) out['/feedback'] = r.feedback;
    if (r.requests) out['/requests'] = r.requests;
    if (r.escalations) { out['/escalations'] = r.escalations; out['/escalations!'] = true; }
    if (r.mywork) out['/work'] = r.mywork;
    return out;
  } catch (e) { return {}; }
}
