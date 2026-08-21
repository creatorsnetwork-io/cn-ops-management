// The debug endpoints exist so problems can be diagnosed without asking anyone
// to run commands. They read raw client content and one of them deletes review
// state, so they are only allowed while the app is running on a local machine.
// Once it is hosted, NODE_ENV is production and they refuse.
export function devOnly() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available.' }, { status: 404 });
  }
  return null;
}
