'use client';
export default function Who({ slug, all, how, name }) {
  async function pick(e) {
    await fetch('/api/me', { method: 'POST', body: JSON.stringify({ slug: e.target.value }) });
    window.location.reload();
  }
  async function out() {
    await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });
    window.location.href = '/signin';
  }

  if (how === 'testing') {
    return (
      <div className="who">
        <span>Testing as</span>
        <select value={slug} onChange={pick}>
          {all.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <a className="btn sm" href="/signin">Sign in properly</a>
      </div>);
  }

  return (
    <div className="who">
      <span>{how === 'google' ? 'Signed in' : 'Signed in locally'}</span>
      <button className="btn sm" onClick={out}>Sign out</button>
    </div>);
}
