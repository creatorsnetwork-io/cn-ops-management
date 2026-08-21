// Pulls plain text out of an uploaded contract.
//
// Loaded through a require the bundler cannot see. A plain import, even inside a
// try, is resolved at build time, so a package that is not installed yet would
// break the whole app rather than just this one feature.
function load(names) {
  const req = eval('require');
  for (const n of names) {
    try { const m = req(n); if (m) return m; } catch (e) {}
  }
  return null;
}

const NEEDS_INSTALL = ' is not installed yet. Run npm install once in the project folder and try again.';

async function pdfText(buf) {
  // The old pdf-parse shipped a 2018 copy of Mozilla's reader, which is where the
  // critical advisory came from. This uses the maintained one directly.
  const mod = load([
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist/legacy/build/pdf.mjs',
    'pdfjs-dist/build/pdf.js',
    'pdfjs-dist',
  ]);
  if (!mod) throw new Error('The PDF reader' + NEEDS_INSTALL);

  const getDocument = mod.getDocument || (mod.default && mod.default.getDocument);
  if (!getDocument) throw new Error('The PDF reader is installed but its shape is not what this expects. Tell me and I will adjust it.');

  const doc = await getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,      // never let a document run script
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines from item positions, otherwise a contract table reads as soup.
    let last = null, line = [];
    const lines = [];
    for (const it of content.items) {
      const y = it.transform ? Math.round(it.transform[5]) : 0;
      if (last !== null && Math.abs(y - last) > 2) { lines.push(line.join('')); line = []; }
      line.push(it.str);
      last = y;
    }
    if (line.length) lines.push(line.join(''));
    parts.push(lines.join('\n'));
  }
  try { await doc.destroy(); } catch (e) {}
  return parts.join('\n\n');
}

export async function textFromFile(buf, filename, mime) {
  const name = String(filename || '').toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || (mime || '').startsWith('text/'))
    return { text: buf.toString('utf8'), how: 'plain text' };

  if (name.endsWith('.pdf') || mime === 'application/pdf')
    return { text: await pdfText(buf), how: 'pdf' };

  if (name.endsWith('.docx')) {
    const mod = load(['mammoth']);
    if (!mod) throw new Error('The Word reader' + NEEDS_INSTALL);
    const mammoth = mod.default || mod;
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value || '', how: 'docx' };
  }

  if (name.endsWith('.doc'))
    throw new Error('Old .doc files cannot be read. Save it as .docx or PDF and upload it again.');

  throw new Error('That file type cannot be read. Use PDF, .docx, or plain text.');
}
