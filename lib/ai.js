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

// A vision look at one slide: does the photo match a place the caption names,
// and is there an actual mistake in whatever text sits on the slide itself.
// Cheaper model than the drafting one above, on purpose, since this runs once
// per slide and slides add up fast on a carousel.
const VISION_MODEL = 'gpt-4o-mini';
// Bump this whenever the instructions below change meaningfully, so cached
// results from the old wording get re-checked instead of served stale forever.
export const CHECK_PROMPT_VERSION = 6;

export async function checkSlide({ imageBuffer, caption, embeddedText }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key in .env.local');
  const b64 = imageBuffer.toString('base64');

  const system = 'You check one slide of a social post for a premium travel and concierge brand. '
    + 'Be exact and brief. Never invent a place or a fact you are not sure of. Never copy an example '
    + 'from your own instructions into your answer, every answer must be your own real observation of this image. '
    + 'This is advisory only, so say so plainly rather than guessing when unsure.';

  const instructions =
    'The caption for this post reads: "' + String(caption || '').slice(0, 600) + '"\n'
    + (embeddedText ? 'The slide already has this text embedded in it: "' + embeddedText.slice(0, 500) + '"\n' : '')
    + 'Look at the attached image and answer all three of these.\n'
    + '1. Does the photo match a place the caption names or clearly implies? Reply "yes", "no", or "unclear" if the caption names no place at all.\n'
    + '2. In your own words, describe in one real sentence what the photo actually shows, the actual scene, landmark, or setting visible in it. This must be a genuine description of this specific image, never a placeholder or a generic phrase.\n'
    + '3. First, transcribe every word of text you can actually see on the slide, exactly as it appears, into visibleText. If the slide has no text at all, visibleText is an empty string. Do this before judging anything, and only transcribe letters you can genuinely see, never a phrase you are inferring or guessing might be there. '
    + 'Then, using only what you just transcribed into visibleText, list genuine mistakes: a misspelling, a cut-off word, a missing word, or grammar that is actually broken. A textIssue about a phrase that is not sitting inside your own visibleText is not allowed, because it means you are flagging something you did not actually transcribe seeing, which has happened before and wasted a reviewer\'s time chasing a mistake that was never on the slide. '
    + 'Do not flag a short line as broken just because it is short, premium travel copy is often written that way on purpose. '
    + 'Do not flag a headline written in full capitals, or in title case, as a mistake, that is a normal design choice on a slide like this, not a grammar error. '
    + 'Only flag capitalization if it looks like an accidental one-off, such as a single stray lowercase letter in the middle of an otherwise capitalized word. '
    + 'For each genuine mistake, give the exact phrase precisely as it appears in your own visibleText, character for character, and separately the corrected version of that same phrase. '
    + 'Before you write either one down, look again and check they actually differ. If your quoted phrase and your corrected phrase would read the same way out loud with the same letters capitalized the same way, you have not found a real mistake, drop it, this happens more than you would expect and it wastes a reviewer\'s time. '
    + 'If there is nothing genuinely wrong, reply with an empty list, an empty list is a completely normal and expected answer, most slides have nothing wrong with them. '
    + 'If any text is too small or unclear for you to read with confidence, put one plain sentence saying so in unclearNote instead of guessing at what it might say, and do not invent a textIssue or a visibleText transcription for it.\n'
    + 'Reply with JSON only, in this exact shape, replacing every value with your own real answer: '
    + '{"placeMatch": "yes, no, or unclear", "whatItShows": "your own one-sentence description of this actual photo", '
    + '"visibleText": "every word of text you can actually see on the slide, transcribed exactly, or an empty string if there is none", '
    + '"textIssues": [{"quoted": "the exact phrase, taken from your own visibleText above", "correction": "that same phrase, corrected", "why": "a few words naming the kind of mistake"}], '
    + '"unclearNote": "a plain sentence if some text was too small or unclear to check with confidence, otherwise an empty string"}';

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [
          { type: 'text', text: instructions },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64, detail: 'high' } },
        ] },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (t.includes('insufficient_quota')) throw new Error('The OpenAI account is out of credit.');
    if (t.includes('rate_limit')) throw new Error('OpenAI is rate limiting. Wait a moment and try again.');
    throw new Error('OpenAI said no on the image check: ' + t.slice(0, 180));
  }
  const j = await r.json();
  const text = ((j.choices || [])[0] || {}).message?.content || '{}';
  let out;
  try { out = JSON.parse(text); } catch (e) { out = { placeMatch: 'unclear', whatItShows: '', visibleText: '', textIssues: [], unclearNote: '' }; }

  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const visibleText = norm(out.visibleText);

  // A model asked to hunt for mistakes will occasionally hand back a
  // 'correction' identical to what it just quoted, confident-sounding but
  // false (seen live: it quoted "Florence" correctly capitalized, then
  // claimed it needed capitalizing). Worse, with the caption sitting right
  // there in the same prompt as the slide, it will sometimes borrow real
  // words straight out of the caption and stitch them into a quoted/corrected
  // pair that it then attributes to the slide's own text, even though the
  // slide never contained that phrase (seen live: the caption for a Liberty
  // carousel read "...the people behind every programme that turn a journey
  // into something..." and separately "35 years. 120+ destinations.", and
  // the check came back flagging slide 4 for "every programme is personal;"
  // and slide 5 for a misspelled "destinihtions." - real words lifted from
  // the caption, glued into sentences that exist on no slide at all). Trusting
  // the prompt alone to prevent either is not enough, so both are enforced
  // here regardless of what the model's own wording claims: the quoted
  // phrase must actually sit inside the same response's own visibleText
  // transcription of that slide, and it must differ from its proposed
  // correction.
  const textIssues = (Array.isArray(out.textIssues) ? out.textIssues : [])
    .map((t) => ({
      quoted: String((t && t.quoted) || '').slice(0, 200),
      correction: String((t && t.correction) || '').slice(0, 200),
      why: String((t && t.why) || '').slice(0, 200),
    }))
    .filter((t) => t.quoted && t.correction && norm(t.quoted) !== norm(t.correction))
    .filter((t) => visibleText.includes(norm(t.quoted)))
    .slice(0, 8);

  return {
    placeMatch: String(out.placeMatch || 'unclear').toLowerCase(),
    whatItShows: String(out.whatItShows || '').slice(0, 200),
    textIssues,
    unclearNote: String(out.unclearNote || '').slice(0, 200),
    model: VISION_MODEL,
  };
}
