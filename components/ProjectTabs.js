import Link from 'next/link';

// One place that decides which sub pages a project has, so every screen shows
// the same set rather than each page listing its own.
export default function ProjectTabs({ slug, type, on }) {
  const tabs = [['', 'Overview']];
  if (type === 'social') {
    tabs.push(['/calendar', 'Calendar tracker']);
    tabs.push(['/review', 'Weekly review']);
    tabs.push(['/count', 'Count']);
  }
  tabs.push(['/prd', 'Working document']);
  tabs.push(['/pack', 'Record of approvals']);

  return (
    <div className="tabs">
      {tabs.map(([suffix, label]) => (
        <Link key={suffix || 'overview'} href={'/projects/' + slug + suffix}
          className={(on || '') === suffix ? 'on' : ''}>{label}</Link>))}
    </div>
  );
}
