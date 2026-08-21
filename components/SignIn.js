'use client';
import { useEffect, useRef, useState } from 'react';

export default function SignIn({ clientId, domain, people, allowLocal, hostReady, origins }) {
  const box = useRef(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('himanshu');

  useEffect(() => {
    if (!clientId || !hostReady) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      if (!window.google || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (res) => {
          setBusy(true); setErr('');
          const r = await fetch('/api/auth', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'google', credential: res.credential }),
          });
          const j = await r.json(); setBusy(false);
          if (j.ok) window.location.href = '/'; else setErr(j.error);
        },
      });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'signin_with', width: 280 });
    };
    document.body.appendChild(s);
  }, [clientId, hostReady]);

  async function local() {
    setBusy(true); setErr('');
    const r = await fetch('/api/auth', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'local', slug: who }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) window.location.href = '/'; else setErr(j.error);
  }

  return (
    <div className="wrap" style={{ maxWidth: 520 }}>
      <img className="logo" src="/cn-logo.png" alt="Creators Network" />
      <div className="eyebrow">Operations</div>
      <h1>Sign in</h1>
      <p className="lede">Only {domain} addresses can open this. Nobody is created automatically, you have to be on the team list already.</p>

      {!clientId ? (
        <div className="alert">No Google sign in client found in the project folder.</div>
      ) : hostReady ? (
        <div className="panel"><div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center' }}><div ref={box} /></div></div>
      ) : (
        <div className="panel">
          <header><h2>Google sign in is not switched on for this address yet</h2></header>
          <div style={{ padding: '14px 16px', fontSize: 13.5, lineHeight: 1.65 }}>
            The sign in client only trusts {origins.length ? origins.join(' and ') : 'no addresses'} so far.
            Add <code>http://localhost:3300</code> to Authorised JavaScript origins in Google Cloud Console
            and this button appears. Nothing else needs changing.
          </div>
        </div>
      )}

      {err ? <div className="alert">{err}</div> : null}

      {allowLocal ? (
        <div className="panel">
          <header><h2>Or carry on testing</h2><span className="pill">only works on this machine</span></header>
          <div style={{ padding: '14px 16px', display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label><div className="k">Sign in as</div>
              <select className="inp" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)}>
                {people.map((p) => <option key={p.slug} value={p.slug}>{p.name}, {p.role}</option>)}
              </select></label>
            <button className="btn dark" disabled={busy} onClick={local}>{busy ? 'Signing in' : 'Carry on'}</button>
          </div>
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
            This route disappears the moment the portal runs anywhere other than a laptop. It is not a
            password anyone can use later.
          </div>
        </div>) : null}
    </div>
  );
}
