import Link from 'next/link';

// One place that decides which sub pages a project has, so every screen shows
// the same set rather than each page listing its own.
export default function ProjectTabs({ slug, type, on, activeTab = 'overview', workCount }) {
  const root = '/projects/' + slug;
  const overviewTabs = [
    ['overview', 'Overview'],
    ['ideas', 'Ideas'],
    ['deliverables', 'Deliverables'],
    ['work', 'Work items' + (Number.isFinite(workCount) ? ' (' + workCount + ')' : '')],
    ['activity', 'Activity log'],
  ];
  const tabs = [];
  if (type === 'social') {
    tabs.push(['/calendar', 'Calendar tracker']);
    tabs.push(['/review', 'Weekly review']);
    tabs.push(['/count', 'Count']);
  }
  tabs.push(['/prd', 'Working document']);
  tabs.push(['/pack', 'Record of approvals']);

  return (
    <div className="tabsrow">
      {overviewTabs.map(([key, label]) => (
        <Link key={key} href={root + '?tab=' + key}
          className={'tb ' + (!on && activeTab === key ? 'on' : '')}>{label}</Link>))}
      {tabs.map(([suffix, label]) => (
        <Link key={suffix} href={root + suffix}
          className={'tb ' + ((on || '') === suffix ? 'on' : '')}>{label}</Link>))}
    </div>
  );
}
