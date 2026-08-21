'use client';
export default function Who({ how, name, role }) {
  async function out() {
    await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });
    window.location.href = '/signin';
  }

  if (how === 'testing') {
    return (
      <>
        <span className="crumb"><b>{name}</b>{role ? <> / {role}</> : null}</span>
        <a className="btn sm" href="/signin">Sign in properly</a>
      </>);
  }

  return (
    <>
      <span className="crumb"><b>{name}</b>{role ? <> / {role}</> : null}</span>
      <button className="btn sm" onClick={out}>Sign out</button>
    </>);
}
