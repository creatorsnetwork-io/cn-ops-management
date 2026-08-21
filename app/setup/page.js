'use client';
import { useEffect, useState } from 'react';

export default function Setup() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      setData(await r.json());
    } catch (e) {
      setData({ checks: [{ name: 'The app itself', ok: false, error: String(e) }], ok: false });
    }
    setLoading(false);
  }
  useEffect(() => { run(); }, []);

  const failed = data ? data.checks.filter((c) => !c.ok) : [];

  return (
    <div className="wrap">
      <img src="/cn-logo.png" className="logo" alt="Creators Network" />
      <div className="eyebrow">Setup check</div>
      <h1>{loading ? 'Checking the connections' : data && data.ok ? 'Everything is connected' : failed.length + ' thing' + (failed.length === 1 ? '' : 's') + ' still to fix'}</h1>
      <p className="lede">
        This page talks to Sanity, Google and OpenAI and tells you exactly what is wrong when something fails.
        Nothing here is guesswork, each line is a real call.
      </p>

      <div className="panel">
        <header>
          <h2>Connections</h2>
          <button className="btn dark" onClick={run} disabled={loading}>{loading ? 'Checking' : 'Check again'}</button>
        </header>
        {loading && <div className="row"><div className="t"><b>Working</b><span>Give it a few seconds.</span></div></div>}
        {!loading && data && data.checks.map((c, i) => (
          <div className="row" key={i}>
            <span className={'dot ' + (c.ok ? 'ok' : 'no')} />
            <div className="t">
              <b>{c.name}</b>
              <span className={c.ok ? '' : 'err'}>{c.ok ? c.detail : c.error}</span>
            </div>
            <span className={'tag ' + (c.ok ? 'ok' : 'no')}>{c.ok ? 'Working' : 'Blocked'}</span>
          </div>
        ))}
      </div>

      {!loading && data && !data.ok && (
        <div className="alert">
          <b>Nothing to worry about.</b> Every line above says what to do. The most common two are a missing service account
          JSON file in this folder, and a sheet or folder that has not been shared with the service account email.
        </div>
      )}
      {!loading && data && data.ok && (
        <div className="guard">
          <b>All green.</b> Next I load your five clients and their projects into Sanity, and this page becomes the real portal.
        </div>
      )}
      <p className="note">
        Secrets are read from <code>.env.local</code> and from the service account JSON in this folder. Neither is ever sent anywhere except to Google and Sanity.
      </p>
    </div>
  );
}
