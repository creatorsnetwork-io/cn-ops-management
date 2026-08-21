import Link from 'next/link';

export default function Mobile() {
  return (
    <>
      <div className="head"><div><div className="eyebrow">Three screens only</div><h1>Mobile</h1><p className="lede">Logging a request, your own queue and feedback triage. Everything else remains desk work with wide operational tables.</p></div></div>
      <div className="phones">
        <div className="ph"><div className="scr"><div className="pt"><span>CN Ops</span><span>9:41</span></div><h4>Log a request</h4><div className="psub">Three taps, fifteen seconds.</div><div className="lbl">Client</div><div className="mchips"><span className="mchip on">EGC</span><span className="mchip">Liberty</span><span className="mchip">Skydome</span></div><div className="lbl">Type</div><div className="mchips"><span className="mchip on">Unplanned ask</span><span className="mchip">Fault</span></div><div className="lbl">Source</div><div className="mchips"><span className="mchip on">WhatsApp</span><span className="mchip">Email</span><span className="mchip">Call</span></div><div className="mfield">Write what the client asked for</div><Link className="mbtn" href="/requests">Log it</Link><p className="note" style={{ textAlign: 'center', marginTop: 9 }}>Opens the live request flow</p></div></div>
        <div className="ph"><div className="scr"><div className="pt"><span>CN Ops</span><span>9:41</span></div><h4>My queue</h4><div className="psub">What you own and what is coming to you.</div><div className="mcard"><b>My work</b><span>Assigned items, due dates and the next permitted verb</span></div><div className="mcard"><b>Coming to me</b><span>Craft, ship and client gates your role can move</span></div><div className="mcard"><b>Late and blocked</b><span>Actual live state, never a separate mobile copy</span></div><Link className="mbtn" href="/work">Open my queue</Link></div></div>
        <div className="ph"><div className="scr"><div className="pt"><span>CN Ops</span><span>9:41</span></div><h4>Feedback</h4><div className="psub">Triage without losing the client wording.</div><div className="mcard"><b>Client change request</b><span>Project, channel and round accounting stay attached</span><div className="ref"><div className="rc">The exact client comment appears here.</div></div><div className="mchips"><span className="mchip on">Create revision</span><span className="mchip">Resolve</span></div></div><Link className="mbtn" href="/feedback">Open feedback</Link></div></div>
      </div>
      <p className="note" style={{ marginTop: 16 }}>The client calendar and freelancer brief are also phone-first. Their public token routes use the same responsive external shell.</p>
    </>
  );
}
