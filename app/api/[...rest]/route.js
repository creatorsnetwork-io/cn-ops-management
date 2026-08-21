export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Anything under /api that does not exist should say so in JSON, not fall
// through to a page. This is what caught the removed debug endpoints still
// answering 200 with an HTML placeholder.
const gone = () => Response.json({ ok: false, error: 'No such endpoint.' }, { status: 404 });

export const GET = gone;
export const POST = gone;
export const PATCH = gone;
export const PUT = gone;
export const DELETE = gone;
