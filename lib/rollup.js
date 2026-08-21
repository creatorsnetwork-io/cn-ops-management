import { sanity } from './sanity';

// Deliverables only count when the client approves. Submitted minus approved is
// the client side delay, which is a number worth showing rather than hiding.
export async function rollup(slug) {
  const weeks = await sanity(true).fetch(
    `*[_type=="weekReview" && projectSlug==$s]|order(week asc){
      week, shipped, "shipAt":shipGate.at, "shipBy":shipGate.by, "override":shipGate.override,
      "craftAt":craftGate.at, "craftBy":craftGate.by,
      clientToken, sharedAt, clientDecisions, flags}`, { s: slug });

  let shipped = 0, approved = 0, changes = 0, answered = 0;
  const rows = weeks.map((w) => {
    const d = w.clientDecisions || [];
    const a = d.filter((x) => x.decision === 'approved').length;
    const ch = d.filter((x) => x.decision === 'changes').length;
    shipped += w.shipped || 0; approved += a; changes += ch; answered += d.length;
    return {
      week: w.week, shipped: w.shipped || 0, approved: a, changes: ch,
      shipAt: w.shipAt || null, shipBy: w.shipBy || null, override: !!w.override,
      craftAt: w.craftAt || null, craftBy: w.craftBy || null,
      shared: !!w.clientToken, sharedAt: w.sharedAt || null,
      flags: (w.flags || []).length,
    };
  });

  // Work items count too, once a client has approved them.
  const work = await sanity(true).fetch(
    `*[_type=="work" && project->slug==$s]{state,kind,approvedBy,approvedAt}`, { s: slug });
  const workSubmitted = work.filter((w) => ['client', 'approved', 'done'].includes(w.state)).length;
  const workApproved = work.filter((w) => ['approved', 'done'].includes(w.state)).length;

  return {
    rows,
    work: { total: work.length, submitted: workSubmitted, approved: workApproved },
    totals: {
      shipped, approved, changes, answered,
      waiting: Math.max(0, shipped - answered),
      allSubmitted: shipped + workSubmitted,
      allApproved: approved + workApproved,
    },
  };
}

export async function rollupAll() {
  const projects = await sanity(true).fetch(
    `*[_type=="project" && type=="social"]|order(name asc){slug,name,deliverables,"client":client->name,"owner":owner->name}`);
  const out = [];
  for (const p of projects) out.push({ ...p, ...(await rollup(p.slug)) });
  return out;
}
