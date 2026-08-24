'use client';
import { useEffect, useState } from 'react';

const FIELDS = [
  ['decided', 'What was decided'],
  ['changed', 'What changed from before'],
  ['rejected', 'What the client rejected'],
  ['tone', 'Tone and preference notes'],
  ['scope', 'New scope implied'],
];

const STATE = {
  found: ['Not read yet', 'mute'],
  drafted: ['Waiting for you', 'warn'],
  accepted: ['Accepted', 'ok'],
  rejected: ['Rejected', 'bad'],
  unreadable: ['Cannot open', 'bad'],
};

const KIND_LABEL = {
  client: 'With the client', internal: 'Internal',
  vendor: 'Vendor or freelancer', prospect: 'Prospect',
};

// Older records only carried a true or false internal flag. Read them the same way
// the server does, so nothing needs migrating.
const kindOf = (n) => (n.kind && KIND_LABEL[n.kind] ? n.kind : (n.internal ? 'internal' : (n.clientSlug ? 'client' : '')));

function readyToDraft(n) {
  const k = kindOf(n);
  if (!k) return 'Say what kind of meeting this was.';
  if (k === 'client' && !n.clientSlug) return 'Pick the client.';
  if (k === 'vendor' && !n.vendorId) return 'Pick the vendor or freelancer.';
  if (k === 'prospect' && !n.prospectId) return 'Pick the prospect.';
  return '';
}

const day = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Time not recorded');
const meetingDay = (t) => {
  if (!t) return '';
  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};
const toText = (a) => (Array.isArray(a) ? a.filter((x) => x != null).join('\n') : String(a || ''));
const toList = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

function Recap({ item, canApprove, onDone, say }) {
  const r = item.recap || {};
  const [edit, setEdit] = useState(() => {
    const e = {};
    for (const [k] of FIELDS) e[k] = toText(r[k]);
    e.open = toText((Array.isArray(r.open) ? r.open : [])
      .filter(Boolean)
      .map((o) => (typeof o === 'string' ? o : (o.owner ? o.q + ' [' + o.owner + ']' : o.q || ''))));
    return e;
  });
  const [busy, setBusy] = useState('');
  const [why, setWhy] = useState('');

  async function send(action) {
    if (action === 'reject' && !why.trim()) { say('Say what was wrong with it.'); return; }
    setBusy(action);
    const recap = {};
    for (const [k] of FIELDS) recap[k] = toList(edit[k]);
    recap.open = toList(edit.open).map((line) => {
      const m = /^(.*)\[(.*)\]\s*$/.exec(line);
      return m ? { q: m[1].trim(), owner: m[2].trim() } : { q: line, owner: '' };
    });
    const res = await fetch('/api/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, id: item._id, recap, note: why }),
    });
    const j = await res.json();
    setBusy('');
    if (!j.ok) { say(j.error); return; }
    onDone(j.item, action === 'accept' ? j.decisions + ' decisions recorded against this client.' : 'Rejected, and the reason is on the record.');
  }

  return (
    <div className="pad" style={{ borderTop: '1px solid var(--line2)' }}>
      {r.summary ? <p className="lede" style={{ marginTop: 0 }}>{r.summary}</p> : null}

      {(r.attendees || []).length ? (
        <div className="fl">
          <div className="lbl">In the meeting</div>
          <div className="chipsline">
            {r.attendees.map((a, i) => (
              <span key={i} className={'tag ' + (a.side === 'them' ? 'info' : a.side === 'us' ? 'mute' : '')}>
                {a.name}{a.side === 'them' ? ' · them' : a.side === 'us' ? ' · us' : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {r.empty ? <div className="alertbar">The notes did not contain anything decisive. Accepting this records nothing, which is the honest outcome for a meeting where nothing was settled.</div> : null}

      <div className="two-in">
        {FIELDS.map(([k, label]) => (
          <div className="fl" key={k} style={k === 'decided' ? { gridColumn: '1 / -1' } : null}>
            <div className="lbl">{label}</div>
            <textarea value={edit[k]} rows={k === 'decided' ? 4 : 3}
              placeholder="Nothing in the notes"
              onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
          </div>
        ))}
        <div className="fl" style={{ gridColumn: '1 / -1' }}>
          <div className="lbl">Open questions, one per line, owner in square brackets</div>
          <textarea value={edit.open} rows={3} placeholder="Nothing in the notes"
            onChange={(e) => setEdit({ ...edit, open: e.target.value })} />
        </div>
      </div>

      <p className="note">One line per item. Edit anything that is wrong before you accept. Decisions, changes and rejections become records against this client. Tone notes wait for the brand brain and change nothing yet.</p>

      {canApprove ? (
        <>
          <div className="fl">
            <div className="lbl">Reason, needed only to reject</div>
            <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What did it get wrong?" />
          </div>
          <div className="rowb" style={{ marginTop: 10 }}>
            <button className="btn dark" disabled={!!busy} onClick={() => send('accept')}>
              {busy === 'accept' ? 'Recording' : 'Accept recap'}</button>
            <button className="btn" disabled={!!busy} onClick={() => send('reject')}>
              {busy === 'reject' ? 'Saving' : 'Reject'}</button>
          </div>
        </>
      ) : <p className="note">Priyanka, Aashif or Himanshu accepts a recap. You can read it and correct it, but not sign it off.</p>}
    </div>
  );
}

function Row({ item, clients, projects, vendors, prospects, rights, onDone, refresh, marker }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [rowErr, setRowErr] = useState('');
  const [cl, setCl] = useState(item.clientSlug || '');
  const [pr, setPr] = useState(item.projectSlug || '');
  const [kind, setKind] = useState(kindOf(item));
  const [vend, setVend] = useState(item.vendorId || '');
  const [prosp, setProsp] = useState(item.prospectId || '');
  const [label, tone] = STATE[item.state] || ['Unknown', 'mute'];

  async function post(body, done) {
    setBusy('1'); setRowErr('');
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    setBusy('');
    if (!j.ok) {
      setRowErr(j.error);
      // A refused document has just been marked unreadable server side. Show that.
      if (r.status === 403) refresh();
      return;
    }
    if (body.action === 'draft') setOpen(true);
    onDone(j.item, done);
  }

  const mine = projects.filter((p) => p.clientSlug === cl);
  const clientName = (clients.find((c) => c.slug === item.clientSlug) || {}).name;
  const vendName = (vendors.find((v) => v._id === item.vendorId) || {}).name;
  const prospName = (prospects.find((x) => x._id === item.prospectId) || {}).name;
  const itemKind = kindOf(item);
  const missing = readyToDraft(item);

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div className="wi">
        <div className="ty">{itemKind === 'internal' ? 'CN' : itemKind === 'vendor' ? 'VEND'
          : itemKind === 'prospect' ? 'NEW' : (clientName || '?').slice(0, 4).toUpperCase()}</div>
        <div className="tx">
          <b>{item.title}</b>
          <span>
            {day(item.meetingAt)}
            {itemKind ? ' · ' + KIND_LABEL[itemKind] : ' · kind not set'}
            {clientName ? ' · ' + clientName : ''}
            {vendName ? ' · ' + vendName : ''}
            {prospName ? ' · ' + prospName : ''}
            {item.viaShortcut ? ' · someone else hosted' : ''}
            {item.chars ? ' · ' + item.chars.toLocaleString() + ' characters' : ''}
          </span>
        </div>
        <div className="mt">
          <div className="lbl">State</div>
          <div className="v"><span className={'tag ' + tone}>{label}</span>
            {marker ? <span className="tag info" style={{ marginLeft: 6 }}>{marker}</span> : null}</div>
        </div>
        <div className="ac">
          {item.state !== 'accepted' && item.state !== 'unreadable' && !missing
            ? <button className="btn sm dark" disabled={!!busy}
                onClick={() => post({ action: 'draft', id: item._id },
                  item.state === 'drafted' ? 'Redrafted from the document again.' : 'Recap drafted. Read it before you accept it.')}>
                {busy ? 'Reading' : (item.state === 'drafted' || item.state === 'rejected' ? '✦ Draft again' : '✦ Draft recap')}</button> : null}
          {item.state === 'found' && missing && !item.emails
            ? <button className="btn sm" disabled={!!busy}
                onClick={() => post({ action: 'identify', id: item._id }, 'Read the attendees.')}>
                {busy ? 'Reading' : 'Who was in it?'}</button> : null}
          {item.state === 'unreadable' ? <span className="tag bad">needs a folder share</span> : null}
          {item.state === 'drafted' || item.state === 'accepted' || item.state === 'rejected'
            ? <button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Read recap'}</button> : null}
          <a className="btn sm" href={'https://docs.google.com/document/d/' + item.driveId + '/edit'} target="_blank" rel="noreferrer">Open in Drive</a>
        </div>
      </div>

      {rowErr ? <div className="pad note" style={{ color: 'var(--bad)' }}>{rowErr}</div> : null}
      {item.matchWhy && (item.state === 'found' || item.state === 'unreadable')
        ? <div className="pad note">{item.matchWhy}</div> : null}
      {missing && item.state === 'found' ? <div className="pad note">{missing}</div> : null}

      {item.state !== 'accepted' && rights.canScan ? (
        <div className="pad" style={{ borderTop: '1px solid var(--line2)' }}>
          <div className="rowb" style={{ flexWrap: 'wrap' }}>
            <select className="f" style={{ width: 'auto' }} value={kind}
              onChange={(e) => setKind(e.target.value)} aria-label="Kind of meeting">
              <option value="">What kind of meeting?</option>
              {Object.keys(KIND_LABEL).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>

            {kind === 'vendor' ? (
              <select className="f" style={{ width: 'auto' }} value={vend} onChange={(e) => setVend(e.target.value)}>
                <option value="">Which vendor or freelancer?</option>
                {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>) : null}

            {kind === 'prospect' ? (
              <select className="f" style={{ width: 'auto' }} value={prosp} onChange={(e) => setProsp(e.target.value)}>
                <option value="">Which prospect?</option>
                {prospects.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
              </select>) : null}

            {kind && kind !== 'prospect' ? (
              <>
                <select className="f" style={{ width: 'auto' }} value={cl}
                  onChange={(e) => { setCl(e.target.value); setPr(''); }}>
                  <option value="">{kind === 'client' ? 'Which client?' : 'About no client'}</option>
                  {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <select className="f" style={{ width: 'auto' }} value={pr}
                  onChange={(e) => setPr(e.target.value)} disabled={!cl}>
                  <option value="">{cl ? 'Any project' : 'Pick a client first'}</option>
                  {mine.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select>
              </>) : null}

            <button className="btn sm dark" disabled={!!busy || !kind}
              onClick={() => post({
                action: 'attach', id: item._id, kind,
                clientSlug: kind === 'prospect' ? '' : cl,
                projectSlug: kind === 'prospect' ? '' : pr,
                vendorId: vend, prospectId: prosp,
              }, 'Saved.')}>Save</button>
          </div>
          <p className="note" style={{ marginBottom: 0 }}>
            {kind === 'internal'
              ? 'An internal meeting can still be about a client. Leave the client set and its decisions land on that account.'
              : kind === 'vendor'
                ? 'Set the client too if this was an outsourced job on their work.'
                : 'What the meeting was and who it was about are separate. Change either until the recap is accepted.'}
          </p>
        </div>
      ) : null}

      {open ? <Recap item={item} canApprove={rights.canApprove} onDone={onDone} say={setRowErr} /> : null}
      {item.state === 'rejected' && item.note ? <div className="pad note">Rejected: {item.note}</div> : null}
    </div>
  );
}

function Folders({ folders, onSaved, say }) {
  const [rows, setRows] = useState(folders.length ? folders : [{ id: '', person: '' }]);
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function save() {
    setBusy(true);
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'folders', folders: rows }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) { say(j.error); return; }
    onSaved(j.folders);
  }

  return (
    <div className="panel">
      <header>
        <div><h2>Which Drive folders to read</h2>
          <div className="sub2">Gemini writes notes into the Drive of whoever hosted the meeting, and Google gives no way to redirect that. So one row per person, each pointing at their own My Drive "Google Meet" folder.</div></div>
        <button className="btn dark" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save folders'}</button>
      </header>
      <div className="pad">
        {rows.map((r, i) => (
          <div className="rowb" key={i} style={{ marginBottom: 8 }}>
            <input type="text" value={r.person || ''} placeholder="Whose folder, e.g. Priyanka"
              style={{ maxWidth: 200 }} onChange={(e) => set(i, 'person', e.target.value)} />
            <input type="text" value={r.id || ''} placeholder="Paste the folder link or its id"
              onChange={(e) => set(i, 'id', e.target.value)} />
            <button className="btn sm" onClick={() => setRows(rows.filter((x, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button className="btn sm" onClick={() => setRows(rows.concat([{ id: '', person: '' }]))}>Add a person</button>
        <p className="note">Each person opens their My Drive, right clicks the Google Meet folder, shares it with the portal address as Viewer, then you paste the folder link here. Until they do, their meetings show as cannot open.</p>
      </div>
    </div>
  );
}

export default function MeetingNotes() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('todo');
  const [range, setRange] = useState('14');
  const [search, setSearch] = useState('');
  const [acted, setActed] = useState({});
  const [busy, setBusy] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [closedDays, setClosedDays] = useState({});

  async function load() {
    const r = await fetch('/api/notes');
    const j = await r.json();
    if (!j.ok) { setErr(j.error); return; }
    setD(j);
  }
  useEffect(() => { load(); }, []);

  function replace(item, said) {
    if (item.state === 'drafted' || item.state === 'accepted' || item.state === 'rejected')
      setActed((prev) => ({ ...prev, [item._id]: item.state }));
    setD((prev) => ({ ...prev, notes: prev.notes.map((n) => (n._id === item._id ? item : n)) }));
    setMsg(said || '');
    setErr('');
  }

  async function scan() {
    setBusy(true); setErr(''); setMsg('');
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'scan' }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) { setErr(j.error); return; }
    setMsg(j.added + ' new of ' + j.found + ' notes found across ' + j.folders + ' folder' + (j.folders === 1 ? '' : 's') + '.'
      + (j.blocked ? ' ' + j.blocked + ' cannot be opened, because whoever hosted those meetings has not shared their folder.' : '')
      + (j.reopened ? ' ' + j.reopened + ' became readable since the last look.' : '')
      + (j.unreadable ? ' ' + j.unreadable + ' folder could not be opened at all.' : ''));
    load();
  }

  if (err && !d) return <><h1>Meeting notes</h1><div className="alertbar">{err}</div></>;
  if (!d) return <><h1>Meeting notes</h1><p className="lede">Reading.</p></>;

  const notes = d.notes || [];
  const counts = {
    todo: notes.filter((n) => n.state === 'drafted').length,
    unread: notes.filter((n) => n.state === 'found' && kindOf(n) && kindOf(n) !== 'internal').length,
    noclient: notes.filter((n) => !kindOf(n) && n.state === 'found').length,
    blocked: notes.filter((n) => n.state === 'unreadable').length,
    internal: notes.filter((n) => kindOf(n) === 'internal').length,
    done: notes.filter((n) => n.state === 'accepted').length,
  };
  const matchesTab = (n) => {
    if (tab === 'todo') return n.state === 'drafted';
    if (tab === 'unread') return n.state === 'found' && kindOf(n) && kindOf(n) !== 'internal';
    if (tab === 'internal') return kindOf(n) === 'internal';
    if (tab === 'nokind') return !kindOf(n) && n.state === 'found';
    if (tab === 'blocked') return n.state === 'unreadable';
    if (tab === 'done') return n.state === 'accepted' || n.state === 'rejected';
    return true;
  };
  const inState = notes.filter((n) => matchesTab(n) || !!acted[n._id]);
  const firstDay = new Date();
  firstDay.setHours(0, 0, 0, 0);
  if (range !== 'all') firstDay.setDate(firstDay.getDate() - Number(range) + 1);
  const inRange = inState.filter((n) => {
    if (range === 'all') return true;
    const at = new Date(n.meetingAt);
    return !!n.meetingAt && !Number.isNaN(at.getTime()) && at >= firstDay;
  });
  const needle = search.trim().toLowerCase();
  const clientNames = Object.fromEntries((d.clients || []).map((c) => [c.slug, c.name]));
  const shown = inRange.filter((n) => !needle
    || String(n.title || '').toLowerCase().includes(needle)
    || String(clientNames[n.clientSlug] || '').toLowerCase().includes(needle));
  const days = [];
  const groups = new Map();
  for (const note of shown) {
    const key = meetingDay(note.meetingAt);
    if (!groups.has(key)) {
      const group = { key, notes: [] };
      groups.set(key, group);
      days.push(group);
    }
    groups.get(key).notes.push(note);
  }
  days.sort((a, b) => (a.key && b.key ? b.key.localeCompare(a.key) : a.key ? -1 : b.key ? 1 : 0));

  const stateName = {
    todo: 'Waiting for you', unread: 'Not read yet', nokind: 'Kind not set',
    internal: 'Internal', blocked: 'Cannot open', done: 'Decided', all: 'Everything',
  }[tab];
  let empty = '';
  if (!notes.length) empty = 'Set the folders, then look for new notes.';
  else if (!inState.length) empty = 'The "' + stateName + '" state filter is hiding every meeting. Try another state.';
  else if (!inRange.length) empty = 'The last ' + range + ' days filter is hiding every meeting in this state. Widen the date range.';
  else if (!shown.length) empty = 'The search for "' + search.trim() + '" matches no meeting title or client in this view.';

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">From Gemini, approved by a person</div>
          <h1>Meeting notes</h1>
          <p className="lede">Gemini already writes notes for every call. This turns them into a recap somebody signs, so a client decision stops living only in the head of whoever was on the call.</p>
        </div>
        <div className="rowb">
          <button className="btn" onClick={() => setShowFolders(!showFolders)}>Folders</button>
          {d.rights.canScan ? <button className="btn ai" disabled={busy} onClick={scan}>{busy ? 'Looking' : '✦ Look for new notes'}</button> : null}
        </div>
      </div>

      {err ? <div className="alertbar">{err}</div> : null}
      {msg ? <div className="pad note">{msg}</div> : null}

      <div className="stats">
        <div><div className="lbl">Waiting for you</div><div className="v">{counts.todo}</div><div className="s">Drafted, not signed</div></div>
        <div><div className="lbl">Not read yet</div><div className="v">{counts.unread}</div><div className="s">Found in Drive</div></div>
        <div><div className="lbl">Kind not set</div><div className="v">{counts.noclient}</div><div className="s">Needs a person to say what it was</div></div>
        <div><div className="lbl">Internal</div><div className="v">{counts.internal}</div><div className="s">Can still be about a client</div></div>
        <div><div className="lbl">Cannot open</div><div className="v">{counts.blocked}</div><div className="s">Hosted by someone else</div></div>
        <div><div className="lbl">On the record</div><div className="v">{counts.done}</div><div className="s">Accepted recaps</div></div>
      </div>

      {showFolders ? <Folders folders={d.folders || []} say={setErr}
        onSaved={(f) => { setD({ ...d, folders: f }); setMsg('Folders saved. Look for new notes to read them.'); }} /> : null}

      <div className="filters">
        {[['todo', 'Waiting for you'], ['unread', 'Not read yet'], ['nokind', 'Kind not set'],
          ['internal', 'Internal'], ['blocked', 'Cannot open'], ['done', 'Decided'],
          ['all', 'Everything']].map(([k, l]) => (
          <button key={k} className={'fchip ' + (tab === k ? 'on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="filters">
        <div className="sbox" style={{ flex: '1 1 300px', maxWidth: 470, border: '1px solid var(--line)' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meeting titles or clients" autoComplete="off" />
        </div>
        <select className="f" style={{ width: 'auto' }} value={range}
          onChange={(e) => setRange(e.target.value)} aria-label="Meeting date range">
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">Everything</option>
        </select>
      </div>

      {shown.length === 0
        ? <div className="panel"><div className="pad note">{empty}</div></div>
        : days.map((group) => {
          const gkey = group.key || 'undated';
          const closed = !!closedDays[gkey];
          return (
          <div key={gkey}>
            <div className="rowb" style={{ alignItems: 'center', margin: '18px 0 9px', cursor: 'pointer' }}
              onClick={() => setClosedDays((prev) => ({ ...prev, [gkey]: !prev[gkey] }))}>
              <div className="lbl">{(closed ? '▸ ' : '▾ ') + (group.key
                ? new Date(group.key + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                }) : 'Meeting day not recorded')}</div>
              <span className="tag mute">{group.notes.length} meeting{group.notes.length === 1 ? '' : 's'}</span>
            </div>
            {closed ? null : group.notes.map((n) => (
              <Row key={n._id} item={n} clients={d.clients || []} projects={d.projects || []}
                vendors={d.vendors || []} prospects={d.prospects || []}
                rights={d.rights} onDone={replace} refresh={load}
                marker={!matchesTab(n) && acted[n._id]
                  ? { drafted: 'Just drafted', accepted: 'Just accepted', rejected: 'Just rejected' }[acted[n._id]]
                  : ''} />
            ))}
          </div>
          );
        })}
    </>
  );
}
