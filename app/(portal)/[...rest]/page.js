export default function NotBuilt({ params }) {
  const path = '/' + (params.rest || []).join('/');
  return (
    <>
      <div className="eyebrow">Not built yet</div>
      <h1>{path}</h1>
      <p className="lede">
        This screen is in the plan and not written yet. It is a real link, not a dead one, so nothing
        in the sidebar goes nowhere. Tell me which of these you want next and it moves up the queue.
      </p>
      <div className="guard">Built so far: Home, Projects, a project page, the calendar tracker, and Connections.</div>
    </>
  );
}
