import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {rooms} from '../worker/rooms.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const db = new DatabaseSync(':memory:');
for (const migration of ['0000_multiplayer.sql', '0001_peer_signaling.sql']) {
  db.exec(await readFile(new URL('../drizzle/' + migration, import.meta.url), 'utf8'));
}
// Preserve the existing room protocol with a small D1-compatible SQLite adapter.
function prepare(sql) {
  const statement = db.prepare(sql);
  let values = [];
  return {
    bind(...args) { values = args; return this; },
    first() { return statement.get(...values) ?? null; },
    all() { return {results: statement.all(...values)}; },
    run() { return {meta: {changes: Number(statement.run(...values).changes)}}; },
    execute() { return statement.columns().length ? this.all() : this.run(); }
  };
}
const DB = {prepare, batch(statements) {
  db.exec('BEGIN');
  try { const results = statements.map(s => s.execute()); db.exec('COMMIT'); return results; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.m4a':'audio/mp4','.mp3':'audio/mpeg','.wav':'audio/wav'};
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') { res.writeHead(200); res.end('ok'); return; }
    if (url.pathname.startsWith('/api/rooms/')) {
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65000) { res.writeHead(413); res.end('Request too large'); return; }
        chunks.push(chunk);
      }
      const origin = process.env.RENDER_EXTERNAL_URL || `http://${req.headers.host}`;
      const request = new Request(new URL(url.pathname, origin), {
        method: req.method, headers: req.headers,
        ...(!['GET','HEAD'].includes(req.method) ? {body: Buffer.concat(chunks)} : {})
      });
      const response = await rooms(request, {DB});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const segments = pathname.split('/');
    if (segments.some(s => s.startsWith('.') || s === 'server') || pathname.includes('\\')) {
      res.writeHead(404); res.end(); return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root) || !(await stat(file)).isFile()) { res.writeHead(404); res.end(); return; }
    let body = await readFile(file);
    if (file.endsWith('/index.html')) {
      // The Open Game button follows this host, never the previous hosting provider.
      body = Buffer.from(body.toString().replaceAll('https://meridian-city-grey.greysonmarker233.chatgpt.site', '/'));
    }
    const headers = {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes'};
    let status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (match) {
        const start = Number(match[1]), end = Math.min(body.length-1, match[2] ? Number(match[2]) : body.length-1);
        if (start > end || start >= body.length) { res.writeHead(416, {'Content-Range': `bytes */${body.length}`}); res.end(); return; }
        headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
        body = body.subarray(start, end+1); status = 206;
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end('Unable to serve request');
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => console.log('Collateral server ready'));
}
