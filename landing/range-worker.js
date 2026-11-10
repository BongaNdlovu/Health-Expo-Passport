/* The landing page is static files. Only the promo video runs through this script, because the static file host
   answers every request with the whole file and Safari will not play a video without byte ranges (206). */
/* The video's bytes, kept per path for the life of this isolate: a Range request (every seek, every viewer) slices the
   copy already read instead of fetching and reading all 4.6 MB again. A deploy starts new isolates, so a new video is
   never served from an old copy. A failed read is forgotten so the next request tries again. */
const videoBuf = new Map();
function readOnce(path, res) {
  if (!videoBuf.has(path)) videoBuf.set(path, res.arrayBuffer().catch(e => { videoBuf.delete(path); throw e; }));
  else res.body && res.body.cancel();
  return videoBuf.get(path);
}
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const isVideo = new URL(request.url).pathname.endsWith('.mp4');
    if (!isVideo || res.status !== 200) return res;
    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = request.headers.get('Range');
    if (!range) return new Response(res.body, { status: 200, headers });
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const buf = await readOnce(new URL(request.url).pathname, res), size = buf.byteLength;
    let start = m && m[1] !== '' ? +m[1] : NaN, end = m && m[2] !== '' ? +m[2] : size - 1;
    if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - +m[2]); end = size - 1; }   /* bytes=-N: the last N bytes */
    if (!m || isNaN(start) || start >= size || end < start) {
      headers.set('Content-Range', 'bytes */' + size);
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(request.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers });
  }
};
