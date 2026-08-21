'use client';
import { can } from '../lib/perm';

// The prototype's permBtn, made real. A role that cannot do a thing does not get
// a button that lies to it: it gets Request, or Oversight, or the scope it holds.
export default function PermButton({ who, cap, label, dark, onClick, onRequest, disabled }) {
  const v = can(who, cap);

  if (v === 'yes')
    return <button className={'btn' + (dark ? ' dark' : '')} disabled={disabled} onClick={onClick}>{label}</button>;

  if (v === 'request')
    return <button className="btn req" disabled={disabled} onClick={onRequest || onClick}
      title="Your role asks rather than does. This goes to your lead.">Request it</button>;

  if (v === 'comment')
    return <button className="btn off" disabled title="You can comment on this, not create it.">{label}</button>;

  if (v === 'exception')
    return <button className="btn req" disabled={disabled} onClick={onClick}
      title="Allowed as an exception, and recorded as one.">{label}, by exception</button>;

  if (v === 'oversight')
    return <button className="btn off" disabled title="You see this, you are not the approver.">Oversight only</button>;

  if (v === 'no') return null;

  return <button className="btn off" disabled title={'Scoped: ' + v}>{v}</button>;
}
