// Turns one Drive file (an image, or a PDF carousel) into a list of small
// slides for the image check: one JPEG per slide, plus any real text pdfjs-dist
// finds already embedded in that page, so the checker does not have to guess
// text with AI when it is sitting there for free.
//
// pdfjs-dist is already used in lib/readdoc.js for reading contract text. Loaded
// the same way it is there, through a require the bundler cannot see, so a
// missing package breaks only this feature and not the whole app.
function load(names) {
  const req = eval('require');
  for (const n of names) {
    try { const m = req(n); if (m) return m; } catch (e) {}
  }
  return null;
}
const NEEDS_INSTALL = ' is not installed yet. Run npm install once in the project folder and try again.';

// pdfjs-dist's own Node canvas factory hard-requires the classic `canvas`
// package, which needs system Cairo libraries to be present on the machine.
// Handing it our own factory backed by @napi-rs/canvas (ships its own prebuilt
// binary, nothing to install separately) avoids that dependency entirely.
function canvasFactory() {
  const mod = load(['@napi-rs/canvas']);
  if (!mod) throw new Error('The image renderer' + NEEDS_INSTALL);
  const { createCanvas } = mod;
  class NapiCanvasFactory {
    create(width, height) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext('2d') }; }
    reset(cc, width, height) { cc.canvas.width = width; cc.canvas.height = height; }
    destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; cc.canvas = null; cc.context = null; }
  }
  return { createCanvas, factory: new NapiCanvasFactory() };
}

const TARGET_WIDTH = 1280; // wide enough to actually read small slide text, not just recognise a scene.
const JPEG_QUALITY = 0.7;

async function pdfToSlides(buf) {
  const mod = load(['pdfjs-dist/legacy/build/pdf.js', 'pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/build/pdf.js', 'pdfjs-dist']);
  if (!mod) throw new Error('The PDF reader' + NEEDS_INSTALL);
  const getDocument = mod.getDocument || (mod.default && mod.default.getDocument);
  const { createCanvas, factory } = canvasFactory();

  const doc = await getDocument({
    data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
    canvasFactory: factory,
  }).promise;

  const slides = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / vp.width;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport, canvasFactory: factory }).promise;
    const jpeg = canvas.toBuffer('image/jpeg', JPEG_QUALITY);

    // Real text pdfjs-dist can already see on the page, no AI guess needed for this part.
    const tc = await page.getTextContent();
    const embeddedText = tc.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();

    slides.push({ page: n, jpeg, embeddedText });
  }
  try { await doc.destroy(); } catch (e) {}
  return slides;
}

// A static image is just one slide, with nothing to pull as "already written" text.
async function imageToSlides(buf, mimeType) {
  const mod = load(['@napi-rs/canvas']);
  if (!mod) throw new Error('The image renderer' + NEEDS_INSTALL);
  const { Image, createCanvas } = mod;
  const img = new Image();
  img.src = buf;
  const scale = img.width ? TARGET_WIDTH / img.width : 1;
  const w = Math.max(1, Math.round((img.width || TARGET_WIDTH) * Math.min(scale, 1)));
  const h = Math.max(1, Math.round((img.height || TARGET_WIDTH) * Math.min(scale, 1)));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toBuffer('image/jpeg', JPEG_QUALITY);
  return [{ page: 1, jpeg, embeddedText: '' }];
}

// The one thing the rest of the app calls. Give it the raw bytes and what
// Drive says the file is, get back a list of slides to check.
export async function mediaToSlides(buf, mimeType) {
  if (mimeType === 'application/pdf') return pdfToSlides(buf);
  if ((mimeType || '').startsWith('image/')) return imageToSlides(buf, mimeType);
  return null; // video, folders, anything else: not handled yet, on purpose.
}
