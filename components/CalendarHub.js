'use client';
import { useState } from 'react';
import Tracker from './Tracker';

export default function CalendarHub({ projects, defaultSlug, canShare }) {
  const first = projects.find((p) => p.slug === defaultSlug) || projects.find((p) => (p.calendarSources || []).length) || projects[0];
  const [slug, setSlug] = useState(first ? first.slug : '');
  const project = projects.find((p) => p.slug === slug) || first;

  if (!project) return <div className="panel"><div className="pad note">No social projects yet.</div></div>;

  return (
    <>
      <div className="filters">
        {projects.map((p) => (
          <button key={p.slug} className={'fchip ' + (p.slug === project.slug ? 'on' : '')} onClick={() => setSlug(p.slug)}>
            {p.client} · {p.name}
          </button>
        ))}
      </div>
      <Tracker key={project.slug} sources={project.calendarSources || []} project={project} canShare={canShare} />
    </>
  );
}
