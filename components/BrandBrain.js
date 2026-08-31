'use client';
import { useState } from 'react';

const FIELDS = [
  { key: 'positioning', label: 'Positioning', kind: 'text',
    note: 'Who this is for and what it promises them. One or two sentences.' },
  { key: 'voiceIs', label: 'The voice is', kind: 'list',
    note: 'Short traits, one per line. How it actually sounds.' },
  { key: 'voiceIsNot', label: 'The voice is never', kind: 'list',
    note: 'The opposite of the above. What it deliberately avoids sounding like.' },
  { key: 'neverSay', label: 'Never say', kind: 'list',
    note: 'Specific words or phrases this brand does not use.' },
  { key: 'always', label: 'Always available', kind: 'list',
    note: 'Facts, proof points or phrases that are always safe to reach for.' },
  { key: 'visual', label: 'Visual direction', kind: 'text',
    note: 'Palette, imagery style and mood, in a sentence or two.' },
];

const TYPE = { social: 'Social', website: 'Website', seo: 'SEO', influencer: 'Influencer', video: 'Film', aiVideo: 'AI video', events: 'Event' };

function Spin() { return <span className="spin" />; }

const toText = (v, kind) => (kind === 'list' ? (Array.isArray(v) ? v.join('\n') : String(v || '')) : String(v || ''));
const toList = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const dedupe = (lines) => {
  const seen = new Set(), out = [];
  for (const l of lines) { const k = l.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(l); } }
  return out;
};

// One client's brand: positioning, voice, never-say, always-available and
// visual direction, plus the document import that proposes them. Lives on the
// client record, so every project under them reads the same fields, and the
// card collapses shut until someone opens it, since a client list gets long.
export default function BrandBrain({ client, canEdit, filled, open, onToggle }) {
  const [fields, setFields] = useState(() => {
    const f = {};
    for (const def of FIELDS) f[def.key] = toText((client.brand || {})[def.key], def.kind);
    return f;
  });
  const [saved, setSaved] = useState(() => ({ ...fields }));
  const [link, setLink] = useState('');
  const [file, setFile] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [source, setSource] = useState(null);
  const [handled, setHandled] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const dirty = FIELDS.some((f) => fields[f.key] !== saved[f.key]);

  async function extract() {
    if (!file && !link.trim()) { setErr('Upload a file or paste a Drive or Google Docs link.'); return; }
    setBusy('ex'); setErr(''); setMsg(''); setProposal(null); setHandled({});
    let r;
    if (file) {
      const fd = new FormData();
      fd.append('slug', client.slug); fd.append('file', file);
      r = await fetch('/api/brand', { method: 'POST', body: fd });
    } else {
      r = await fetch('/api/brand', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'extract', slug: client.slug, link }),
      });
    }
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    setProposal(j.proposal); setSource(j.source);
    setMsg('Read ' + j.source.characters.toLocaleString() + ' characters from ' + j.source.filename + '.');
  }

  function useIt(key, kind) {
    setFields({ ...fields, [key]: toText(proposal[key], kind) });
    setHandled({ ...handled, [key]: true });
  }
  function mergeIt(key, kind) {
    if (kind === 'list') {
      const merged = dedupe(toList(fields[key]).concat(toList(toText(proposal[key], kind))));
      setFields({ ...fields, [key]: merged.join('\n') });
    } else {
      const cur = fields[key].trim(), add = String(proposal[key] || '').trim();
      setFields({ ...fields, [key]: cur ? cur + '\n\n' + add : add });
    }
    setHandled({ ...handled, [key]: true });
  }
  function ignoreIt(key) { setHandled({ ...handled, [key]: true }); }

  async function save() {
    setBusy('sv'); setErr(''); setMsg('');
    const brand = {};
    for (const def of FIELDS) brand[def.key] = def.kind === 'list' ? toList(fields[def.key]) : fields[def.key].trim();
    const r = await fetch('/api/brand', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug: client.slug, brand }),
    });
    const j = await r.json(); setBusy('');
    if (!j.ok) { setErr(j.error); return; }
    setSaved({ ...fields }); setMsg('Saved.');
  }

  const pending = proposal ? FIELDS.filter((f) => {
    const v = proposal[f.key];
    const has = f.kind === 'list' ? (Array.isArray(v) && v.length) : (v && String(v).trim());
    return has && !handled[f.key] && toText(v, f.kind).trim() !== fields[f.key].trim();
  }) : [];

  const projects = client.projects || [];

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <header style={{ cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <h2>{open ? '▾ ' : '▸ '}{client.name}</h2>
          <div className="sub2">
            {projects.length ? projects.map((p) => TYPE[p.type] || p.type || p.name).join(', ') : 'No projects yet'}
          </div>
        </div>
        <span className="pill">{filled} of {FIELDS.length} fields set</span>
      </header>

      {!open ? null : (
        <>
          {canEdit ? (
            <div className="pad" style={{ borderBottom: '1px solid var(--line2)' }} onClick={(e) => e.stopPropagation()}>
              <div className="rowb" style={{ flexWrap: 'wrap' }}>
                <input type="file" accept=".pdf,.docx,.txt,.md,.csv" style={{ fontSize: 13 }}
                  onChange={(e) => { setFile(e.target.files[0]); setLink(''); }} />
                <span className="note" style={{ margin: 0 }}>or</span>
                <input type="text" placeholder="Paste a Drive or Google Docs link" style={{ flex: '1 1 260px' }}
                  value={link} onChange={(e) => { setLink(e.target.value); setFile(null); }} />
                <button className="btn sm ai" disabled={busy === 'ex'} onClick={extract}>
                  {busy === 'ex' ? <>Reading <Spin /></> : '✦ Read this document'}</button>
              </div>
              <p className="note" style={{ marginBottom: 0 }}>
                PDF, .docx, plain text, or a link to a file or Google Doc in Drive. Only what the document
                actually says gets proposed, nothing is invented, and nothing changes here until you pick or
                merge each field below.
              </p>
            </div>
          ) : null}

          {err ? <div className="pad note" style={{ color: 'var(--bad)' }}>{err}</div> : null}
          {msg && !pending.length ? <div className="pad note" style={{ color: 'var(--ok)' }}>{msg}</div> : null}

          <div className="pad" style={{ display: 'grid', gap: 14 }}>
            {projects.length ? (
              <div className="note" style={{ margin: 0 }}>
                Shared by {projects.length} project{projects.length === 1 ? '' : 's'}: {projects.map((p) => p.name).join(', ')}.
              </div>
            ) : null}
            {FIELDS.map((def) => {
              const sug = pending.find((p) => p.key === def.key);
              return (
                <div className="fl" key={def.key}>
                  <div className="lbl">{def.label}</div>
                  <textarea rows={def.kind === 'text' ? 3 : 4} disabled={!canEdit}
                    value={fields[def.key]} placeholder={def.note}
                    onChange={(e) => setFields({ ...fields, [def.key]: e.target.value })} />
                  <p className="note" style={{ marginTop: 4, marginBottom: 0 }}>{def.note}</p>
                  {sug ? (
                    <div style={{ marginTop: 7, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg2, rgba(0,0,0,.02))' }}>
                      <div className="note" style={{ marginBottom: 7, whiteSpace: 'pre-wrap' }}>
                        From the document: <i>{toText(proposal[def.key], def.kind)}</i>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn sm dark" onClick={() => useIt(def.key, def.kind)}>Use this instead</button>
                        <button className="btn sm" onClick={() => mergeIt(def.key, def.kind)}>Add to current</button>
                        <button className="btn sm" onClick={() => ignoreIt(def.key)}>Ignore</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {canEdit ? (
            <div className="pad" style={{ borderTop: '1px solid var(--line2)', display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button className="btn dark" disabled={busy === 'sv' || !dirty} onClick={save}>
                {busy === 'sv' ? <>Saving <Spin /></> : 'Save'}</button>
              {pending.length ? <span className="note">{pending.length} field{pending.length === 1 ? '' : 's'} from the document still waiting on a decision above.</span> : null}
              {source ? <span className="note">Last read: {source.filename} ({source.how}).</span> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
