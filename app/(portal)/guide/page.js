import { meSlug, me } from '../../../lib/me';
import { navFor, fullPermTable } from '../../../lib/perm';
import { NAV_BLURBS, PERM_ORDER, describeLevel } from '../../../lib/guideContent';

export const dynamic = 'force-dynamic';

export default async function Guide() {
  const slug = meSlug();
  let who = { slug, person: { name: '', role: '' } };
  try { who = await me(); } catch (e) { /* still renders, just without a name/role line */ }

  const [groups, table] = await Promise.all([navFor(slug), fullPermTable()]);

  const perms = PERM_ORDER
    .map((p) => ({ ...p, level: describeLevel((table[p.key] || {})[slug]) }))
    .filter((p) => p.level);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Just for you</div>
          <h1>Your guide</h1>
          <p className="lede">
            Built from your own access, not a shared manual. Change what someone can do on the Team page and their guide changes with it.
          </p>
        </div>
      </div>

      <div className="panel">
        <header><h2>How this portal works</h2></header>
        <div style={{ padding: '13px 16px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          <p>The portal holds state and links. Google holds the content: calendars stay in Sheets, files stay in Drive, notes stay in Docs.</p>
          <p style={{ marginTop: 8 }}>Nothing gets a screen unless there is a verb that moves something and a page that explains it. Every screen below has a real action behind it.</p>
        </div>
      </div>

      <div className="panel">
        <header><h2>Your screens</h2><span className="hint">{who.person?.name}{who.person?.role ? ', ' + who.person.role : ''}</span></header>
        {groups.map((g) => (
          <div key={g.g}>
            <div style={{ padding: '9px 16px', background: 'var(--head)', borderBottom: '1px solid var(--line2)' }}>
              <span className="lbl">{g.g}</span>
            </div>
            {g.items.map((i) => (
              <div key={i.href} className="row">
                <div className="t" style={{ flex: 1 }}>
                  <b>{i.l}</b>
                  <span>{NAV_BLURBS[i.href] || 'No description written yet for this screen.'}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 ? <div className="empty">Nothing is on your nav yet.</div> : null}
      </div>

      <div className="panel">
        <header><h2>What you can do</h2><span className="hint">{perms.length} of {PERM_ORDER.length} capabilities</span></header>
        {perms.map((p) => (
          <div key={p.key} className="row">
            <div className="t" style={{ flex: 1 }}>
              <b>{p.label}</b>
              <span>{p.blurb}</span>
              <div className="dim" style={{ marginTop: 4, fontSize: 12, color: 'var(--faint)' }}>{p.level.say}</div>
            </div>
            <span className={'tag ' + p.level.tag}>{p.level.label}</span>
          </div>
        ))}
        {perms.length === 0 ? <div className="empty">Nothing beyond what is on your screens above.</div> : null}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line2)', fontSize: 12, color: 'var(--faint)' }}>
          Levels are read straight from Team and capacity. If something here looks wrong, that is where it gets fixed, not in this page.
        </div>
      </div>
    </>
  );
}
