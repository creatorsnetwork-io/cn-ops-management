'use client';
import { useState } from 'react';
import Link from 'next/link';

function Limits({ initial, fallback, canEdit, onSave }) {
  const [rows, setRows] = useState(initial.length ? initial : fallback.map((f) => ({
    channel: f.name, chars: String(f.chars).replace(/,/g, ''), tagsMin: f.tags.split(' to ')[0], tagsMax: f.tags.split(' to ')[1] || f.tags,
  })));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function save() {
    setBusy(true); setMsg('');
    const r = await onSave(rows);
    setBusy(false);
    setMsg(r.ok ? 'Saved.' : (r.error || 'Could not save.'));
  }

  return (
    <div className="panel">
      <header>
        <h2>Channel limits the checks use</h2>
        {canEdit ? <span style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => setRows([...rows, { channel: '', chars: '1000', tagsMin: '0', tagsMax: '5' }])}>Add a channel</button>
          <button className="btn sm dark" disabled={busy} onClick={save}>Save</button>
        </span> : <span className="pill">view only</span>}
      </header>
      <table>
        <thead><tr><th>Channel</th><th style={{ width: 140 }}>Characters</th><th style={{ width: 120 }}>Hashtags, least</th><th style={{ width: 120 }}>Hashtags, most</th>{canEdit ? <th style={{ width: 60 }} /> : null}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input type="text" value={r.channel} disabled={!canEdit} onChange={(e) => set(i, 'channel', e.target.value)} /></td>
              <td><input type="text" value={r.chars} disabled={!canEdit} onChange={(e) => set(i, 'chars', e.target.value)} /></td>
              <td><input type="text" value={r.tagsMin} disabled={!canEdit} onChange={(e) => set(i, 'tagsMin', e.target.value)} /></td>
              <td><input type="text" value={r.tagsMax} disabled={!canEdit} onChange={(e) => set(i, 'tagsMax', e.target.value)} /></td>
              {canEdit ? <td><button className="btn sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Drop</button></td> : null}
            </tr>))}
        </tbody>
      </table>
      {msg ? <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div> : null}
      <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
        Going over the character limit is a blocking flag, because the post physically will not publish.
        Hashtag counts are advisory. Channel names are matched loosely, so IG matches Instagram.
      </div>
    </div>
  );
}

function Voice({ p, canEdit, onSave }) {
  const [text, setText] = useState(p.voice || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    const r = await onSave(text);
    setBusy(false);
    setMsg(r.ok ? 'Saved.' : (r.error || 'Could not save.'));
  }

  return (
    <div className="panel">
      <header>
        <h2>How {p.client || p.name} sounds</h2>
        {canEdit ? <button className="btn sm dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save'}</button> : <span className="pill">view only</span>}
      </header>
      <div style={{ padding: '14px 16px' }}>
        <textarea style={{ minHeight: 140 }} value={text} disabled={!canEdit}
          placeholder="Write it the way you would brief a new writer. What the brand is, how it talks, what it never does."
          onChange={(e) => setText(e.target.value)} />
        <p className="note" style={{ marginTop: 8 }}>
          Every draft for {p.name} is written against this. Left empty, drafts come back deliberately
          plain rather than inventing a personality.
        </p>
        {msg ? <div style={{ marginTop: 8, fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div> : null}
      </div>
    </div>
  );
}

function WordList({ title, note, words, onSave, canEdit }) {
  const [text, setText] = useState((words || []).join('\n'));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    const list = text.split('\n').map((x) => x.trim()).filter(Boolean);
    const r = await onSave(list);
    setBusy(false);
    setMsg(r.ok ? 'Saved.' : (r.error || 'Could not save.'));
  }

  return (
    <div className="panel">
      <header>
        <h2>{title}</h2>
        {canEdit ? <button className="btn sm dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save'}</button> : <span className="pill">view only</span>}
      </header>
      <div style={{ padding: '14px 16px' }}>
        <textarea style={{ minHeight: 130, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5 }}
          value={text} disabled={!canEdit} onChange={(e) => setText(e.target.value)} />
        <p className="note" style={{ marginTop: 8 }}>{note}</p>
        {msg ? <div style={{ marginTop: 8, fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div> : null}
      </div>
    </div>
  );
}

export default function Settings({ house, projects, canEdit, limits, builtIn }) {
  const [hour, setHour] = useState(house.digestHour != null ? house.digestHour : 8);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const post = (body) => fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

  async function saveHour() {
    setBusy(true); setMsg('');
    const j = await post({ scope: 'house', digestHour: hour });
    setBusy(false); setMsg(j.ok ? 'Saved.' : (j.error || 'Could not save.'));
  }

  return (
    <>
      <div className="grid2">
        <div className="panel">
          <header><h2>Rules</h2></header>
          <table><tbody>
            <tr><td className="b" style={{ width: 225 }}>Lead time on unplanned requests</td><td>Due date set per request<div className="note">Fault handling remains in the live request flow</div></td></tr>
            <tr><td className="b">Revision rounds included</td><td>Not stored globally<div className="note">Work and feedback keep their live round accounting</div></td></tr>
            <tr><td className="b">Daily digest</td><td>{String(hour).padStart(2, '0')}:00 GST<div className="note">Scheduled delivery starts after hosting</div></td></tr>
            <tr><td className="b">Image generation cap</td><td>Not stored<div className="note">No usage-cap field in the current settings API</div></td></tr>
            <tr><td className="b">Calendar recheck</td><td>On demand<div className="note">Manual reads use the existing calendar endpoint</div></td></tr>
            <tr><td className="b">Record retention</td><td>Append only activity<div className="note">Operational records survive project closure</div></td></tr>
          </tbody></table>
        </div>
        <div>
          <div className="panel">
            <header><h2>Integrations</h2><Link className="btn sm" href="/setup">Run live checks</Link></header>
            <table><tbody>
              {[
                ['Google Sheets', 'Read calendars; writes use empty cells only'],
                ['Google Drive', 'Folders, files and external previews'],
                ['Google Docs', 'Generated copy and working documents'],
                ['OpenAI', 'Company key for assisted creation'],
                ['Gemini', 'Meeting-note workflow'],
                ['WhatsApp digest', 'Outbound runner not hosted yet'],
              ].map((r) => <tr key={r[0]}><td className="b">{r[0]}</td><td className="dim">{r[1]}</td><td><span className="tag mute">Check live</span></td></tr>)}
            </tbody></table>
          </div>
          <div className="panel">
            <header><h2>Who can change settings</h2></header>
            <div className="pad"><p className="note">Himanshu and Aashif can edit. Everyone else with a future view route remains read only. Every save continues through the existing settings permission.</p></div>
          </div>
        </div>
      </div>

      <div className="lbl" style={{ margin: '22px 0 8px' }}>Quality and voice controls</div>
      <div className="panel">
        <header><h2>Phrases built into the checks</h2><span className="pill">{(builtIn || []).length}, not editable</span></header>
        <div style={{ padding: '13px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(builtIn || []).map((b) => <span key={b} className="pill">{b}</span>)}
        </div>
        <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          These are the house rules, the ones that do not change with a client. Add to them below rather
          than arguing with them.
        </div>
      </div>

      <WordList
        title="Phrases you have added"
        note="One per line. Any caption containing one of these raises an advisory flag, never a blocking one. Case does not matter."
        words={house.bannedPhrases}
        canEdit={canEdit}
        onSave={(list) => post({ scope: 'house', bannedPhrases: list })}
      />

      {projects.map((p) => (
        <Voice
          key={p.slug + 'v'}
          p={p}
          canEdit={canEdit}
          onSave={(voice) => post({ scope: 'voice', slug: p.slug, voice })}
        />))}

      {projects.filter((p) => p.type === 'social').map((p) => (
        <WordList
          key={p.slug}
          title={'Extra phrases for ' + p.name}
          note={'On top of the house list, only for ' + (p.client || p.name) + '. Use it for words a particular client has asked you never to use.'}
          words={p.extraBanned}
          canEdit={canEdit}
          onSave={(list) => post({ scope: 'project', slug: p.slug, extraBanned: list })}
        />))}

      <div className="panel">
        <header><h2>The daily digest</h2>
          {canEdit ? <button className="btn sm dark" disabled={busy} onClick={saveHour}>{busy ? 'Saving' : 'Save'}</button> : null}</header>
        <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label><div className="fl">Sent at, Dubai time</div>
            <select className="f" style={{ width: 'auto' }} value={hour} disabled={!canEdit} onChange={(e) => setHour(+e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select></label>
          {msg ? <span style={{ fontSize: 13, color: msg === 'Saved.' ? 'var(--ok)' : 'var(--bad)' }}>{msg}</span> : null}
        </div>
        <div style={{ padding: '11px 16px', borderTop: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--faint)' }}>
          Nothing is sent yet. The digest needs something running that is not a laptop, so it starts
          working the day this is hosted. The time is stored now so it is not another decision then.
        </div>
      </div>

      <Limits initial={house.limits || []} fallback={limits} canEdit={canEdit} onSave={(rows) => post({ scope: 'house', limits: rows })} />
    </>
  );
}
