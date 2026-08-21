'use client';
export default function Who({ how, name, role }) {
  async function out() {
    await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });
    window.location.href = '/signin';
  }

  if (how === 'testing') {
    return (
      <div className="who">
        <span className="whoIdentity"><b>{name}</b>{role ? <small>{role}</small> : null}</span>
        <a className="btn sm signinProper" href="/signin">Sign in properly</a>
      </div>);
  }

  return (
    <div className="who">
      <span className="whoIdentity"><b>{name}</b>{role ? <small>{role}</small> : null}</span>
      <button className="btn sm" onClick={out}>Sign out</button>
    </div>);
}
