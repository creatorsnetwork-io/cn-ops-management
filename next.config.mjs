// lib/readdoc.js and lib/pdfrender.js load pdfjs-dist, @napi-rs/canvas, and
// mammoth through `eval('require')(name)` on purpose, so a package that
// hasn't been npm installed locally yet degrades to a friendly message
// instead of breaking the whole build. The side effect: that same trick
// hides the dependency from the file tracer Netlify uses to decide which
// node_modules files to ship with each serverless function, so those
// packages never made it into the deployed function even though they were
// genuinely installed at build time. This forces them back in regardless of
// what static analysis can see.
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/**': [
        './node_modules/pdfjs-dist/**',
        './node_modules/@napi-rs/canvas/**',
        './node_modules/mammoth/**',
      ],
    },
  },
};
export default nextConfig;
