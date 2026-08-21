export async function POST(req) {
  const { slug } = await req.json();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': `cn_me=${encodeURIComponent(slug || 'himanshu')}; Path=/; Max-Age=31536000; SameSite=Lax`,
    },
  });
}
