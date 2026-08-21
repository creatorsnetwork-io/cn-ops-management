// A thin wrapper over OpenAI. Deliberately small: the portal's judgement lives in
// lib/qc.js, which is deterministic. This file only drafts, it never decides.

let picked = null;

const PREF = [
  (id) => /^gpt-4o$/.test(id),
  (id) => /^gpt-4o-\d/.test(id),
  (id) => /^gpt-4\.1$/.test(id),
  (id) => /gpt-4o-mini/.test(id),
  (id) => /^gpt-4/.test(id),
  (id) => /^gpt-3\.5/.test(id),
];

// Ask the account what it actually has rather than guessing a model name.
export async function model() {
  if (picked) return picked;
  if (process.env.OPENAI_MODEL) { picked = process.env.OPENAI_MODEL; return picked; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key in .env.local');
  const r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: 'Bearer ' + key } });
  if (!r.ok) throw new Error('OpenAI rejected the key when listing models.');
  const ids = ((await r.json()).data || []).map((m) => m.id);
  for (const test of PREF) {
    const hit = ids.find(test);
    if (hit) { picked = hit; return picked; }
  }
  throw new Error('That OpenAI account has no chat model available.');
}

export async function chat({ system, user, json, maxTokens }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key in .env.local');
  const m = await model();
  const body = {
    model: m,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0.7,
    max_tokens: maxTokens || 1600,
  };
  if (json) body.response_format = { type: 'json_object' };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    if (t.includes('insufficient_quota')) throw new Error('The OpenAI account is out of credit.');
    if (t.includes('rate_limit')) throw new Error('OpenAI is rate limiting. Wait a moment and try again.');
    throw new Error('OpenAI said no: ' + t.slice(0, 180));
  }
  const j = await r.json();
  const text = ((j.choices || [])[0] || {}).message?.content || '';
  return { text, model: m, usage: j.usage || null };
}

// The house rules, applied to every draft. These mirror lib/qc.js so a draft does
// not arrive already failing its own checks.
export const HOUSE = `Rules that override everything else:
- No em dashes. Use commas, colons or a new line.
- Never write "excited to share", "thrilled to announce", "humbled", "game-changer", "disruptive", "synergy", "in today's fast-paced", "best-in-class", or "deliver results".
- No self-congratulation. No corporate filler. No AI-sounding prose.
- Specific over general. Name the real thing rather than gesturing at a category.
- Do not invent facts, prices, dates, names or claims. If something is needed and unknown, leave a clearly marked gap in square brackets.`;

export const LIMITS_TEXT = `Character limits that must not be exceeded: Instagram 2200, X 280, LinkedIn 3000, Facebook 5000, Threads 500.
Hashtag guidance: Instagram 3 to 12, LinkedIn up to 5, Facebook up to 6, X up to 3.`;
