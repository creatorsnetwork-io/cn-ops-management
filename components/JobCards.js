'use client';
import { useState } from 'react';

const stamp = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded');

export default function JobCards({ cards }) {
  const [runs, setRuns] = useState({});

  async function run(card) {
    setRuns((s) => ({ ...s, [card.id]: { busy: true, result: 'Running' } }));
    try {
      const r = await fetch(card.endpoint, { cache: 'no-store' });
      const j = await r.json();
      const failed = j.ok === false || (Array.isArray(j.checks) && j.checks.some((x) => !x.ok));
      let result = failed ? (j.error || 'Completed with failures') : 'Completed successfully';
      if (j.totals) result = j.totals.ready + ' ready, ' + j.totals.pending + ' pending';
      if (j.projects) result = j.projects.length + ' project rollup(s) read';
      if (j.checks) result = j.checks.filter((x) => x.ok).length + ' of ' + j.checks.length + ' checks passed';
      setRuns((s) => ({ ...s, [card.id]: { busy: false, bad: failed || !r.ok, result, at: new Date().toISOString() } }));
    } catch (e) {
      setRuns((s) => ({ ...s, [card.id]: { busy: false, bad: true, result: String(e).slice(0, 140), at: new Date().toISOString() } }));
    }
  }

  return (
    <div className="jobs">
      {cards.map((card) => {
        const live = runs[card.id];
        const status = live?.bad ? 'Failed' : live && !live.busy ? 'Healthy' : card.status;
        return (
          <div className="job" key={card.id}>
            <div className="jt"><span className={'dotg ' + (status === 'Scheduled' || status === 'Waiting' ? 's' : '')} /><span className={'tag ' + (status === 'Healthy' || status === 'Ready' ? 'ok' : status === 'Failed' || status === 'Needs attention' ? 'bad' : 'warn')}>{live?.busy ? 'Running' : status}</span></div>
            <h4>{card.name}</h4><div className="jd">{card.schedule}</div>
            <div className="jr"><span>Last run</span><span>{live?.at ? stamp(live.at) : stamp(card.last)}</span></div>
            <div className="jr"><span>Next</span><span>{card.next}</span></div>
            <div className="jr"><span>Result</span><span>{live?.result || card.result}</span></div>
            <button disabled={!card.endpoint || live?.busy} onClick={() => run(card)} title={!card.endpoint ? 'No manual-run endpoint exists for this job' : ''}>{live?.busy ? 'Running' : 'Run now'}</button>
          </div>);
      })}
    </div>
  );
}
