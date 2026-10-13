#!/usr/bin/env node
// Smoke test of the production server: status codes, key HTML content, serialized state, redirects, API.
// Usage: node scripts/smoke.mjs [--start] [--network]
//   --start    boots `node src/server/boot.ts` (NODE_ENV=production) on a free port and stops it at the end;
//              needs a previous `npm run build`. Without it, the checks run against BASE_URL (default http://localhost:3000).
//   --network  also checks /swpeople, which calls the public swapi.dev (off by default: flaky without internet).
// Exit: 0 all ok, 1 a check failed, 2 the server could not be reached or started.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});

let server = null;
let base = process.env.BASE_URL || 'http://localhost:3000';

async function start() {
  if (!fs.existsSync(path.join(ROOT, 'dist/server/render.cjs'))) { console.error('smoke: dist/ is missing, run `npm run build` first'); process.exit(2); }
  const port = await freePort();
  base = `http://localhost:${port}`;
  let log = '';
  server = spawn('node', ['src/server/boot.ts'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  server.on('exit', (code) => { if (code) { console.error(`smoke: server exited with ${code}\n${log}`); process.exit(2); } });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/status`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  console.error(`smoke: server did not answer on ${base}\n${log}`);
  process.exit(2);
}

const get = async (url, headers) => {
  const res = await fetch(base + url, { redirect: 'manual', headers });
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
};
// The state serialized in the HTML is valid JSON (serialize-javascript with isJSON).
const stateKeys = (html) => {
  const m = html.match(/window\.__INITIAL_STATE__=(\{.*?\});window\.__ROUTER_DATA__/s);
  return m ? Object.keys(JSON.parse(m[1])).sort().join(',') : null;
};

let failed = 0, total = 0;
const check = (name, ok, detail = '') => {
  total++;
  if (ok) console.log(`ok   ${name}`); else { failed++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ''}`); }
};

async function run() {
  const home = await get('/', { cookie: 's=SECRET' });
  check('/ 200 with fixture data in the HTML', home.status === 200 && home.body.includes('Trova la casa giusta per te'), `status ${home.status}`);
  check('/ serializes only config + home', stateKeys(home.body) === 'config,home', stateKeys(home.body));
  check('/ does not leak the request cookie', !home.body.includes('SECRET'));
  check('/ has no modal or footer content', !home.body.includes('__MODAL_LOGIN__') && !home.body.includes('__FOOTER_CONTENT__'));
  const scripts = [...home.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  check('/ loads only vendor, main and route scripts', scripts.length > 0 && !scripts.some((s) => /modal|footer/.test(s)), scripts.join(' '));

  const listing = await get('/annunci/1');
  check('/annunci/1 200 with the listing', listing.status === 200 && listing.body.includes('Trilocale luminoso in centro'), `status ${listing.status}`);
  check('/annunci/1 serializes only config + listing', stateKeys(listing.body) === 'config,listing', stateKeys(listing.body));
  check('/annunci/999 404', (await get('/annunci/999')).status === 404);
  check('/unknown 404', (await get('/non-esiste')).status === 404);

  const redirect = await get('/vecchia-url');
  check('/vecchia-url 301 to /annunci/1', redirect.status === 301 && redirect.location === '/annunci/1', `${redirect.status} ${redirect.location}`);

  check('/cerca 200', (await get('/cerca')).status === 200);
  const found = await get('/cerca?q=milano');
  check('/cerca?q=milano 200, indexable', found.status === 200 && !found.body.includes('noindex'), `status ${found.status}`);
  const empty = await get('/cerca?q=zzz');
  check('/cerca?q=zzz 404 with the full search page and noindex', empty.status === 404 && empty.body.includes('noindex') && empty.body.includes('role="search"'), `status ${empty.status}`);

  const api = await get('/api/v1/home');
  check('/api/v1/home 200 JSON', api.status === 200 && JSON.parse(api.body).headline === 'Trova la casa giusta per te');
  check('/api/v1/listings/1 200', (await get('/api/v1/listings/1')).status === 200);
  check('/api/v1/listings/999 404', (await get('/api/v1/listings/999')).status === 404);

  if (args.has('--network')) {
    const sw = await get('/swpeople/1');
    check('/swpeople/1 200 (needs swapi.dev)', sw.status === 200 && stateKeys(sw.body) === 'config,swpeople', `status ${sw.status} ${stateKeys(sw.body)}`);
    check('/swpeople/99999 404 (needs swapi.dev)', (await get('/swpeople/99999')).status === 404);
  }
}

try {
  if (args.has('--start')) await start();
  else { try { await fetch(`${base}/status`); } catch { console.error(`smoke: no server on ${base} (use --start, or BASE_URL)`); process.exit(2); } }
  await run();
} catch (e) {
  console.error(`smoke: ${e.stack || e}`);
  failed++;
} finally {
  server?.removeAllListeners('exit');
  server?.kill('SIGTERM');
}
console.log(`\n${total - failed}/${total} passed${args.has('--network') ? '' : ' (network checks skipped: --network)'}`);
process.exit(failed ? 1 : 0);
