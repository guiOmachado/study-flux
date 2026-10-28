/**
 * Simulador local do comportamento da Netlify, para validar `netlify.toml`
 * sem publicar nada: serve `web/dist` como estático, aplica as mesmas regras de
 * redirect (a primeira que casa vence, na ordem do arquivo) e faz o proxy de
 * `/api/*` para a API, repassando cookies e `x-forwarded-proto: https`, como a
 * Netlify faz.
 *
 * O domínio de destino escrito no `netlify.toml` é ignorado de propósito: quem
 * manda é o segundo argumento, para você testar sem publicar.
 *
 * Uso: node scripts/netlify-sim.mjs [porta] [origem-da-api]
 *      node scripts/netlify-sim.mjs 5180 http://127.0.0.1:5173
 *      SMOKE_BASE=http://127.0.0.1:5180 npm run test:web
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2] ?? 5180);
const API = new URL(process.argv[3] ?? 'http://127.0.0.1:5173');
const DIST = path.join(process.cwd(), 'web', 'dist');

const toml = fs.readFileSync('netlify.toml', 'utf8');
const redirects = [...toml.matchAll(/\[\[redirects\]\][^[]*?from\s*=\s*"([^"]+)"[^[]*?to\s*=\s*"([^"]+)"[^[]*?status\s*=\s*(\d+)/g)].map((m) => ({
  from: m[1],
  to: m[2],
  status: Number(m[3]),
}));
console.log('[sim] regras carregadas:', redirects);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function patternToRegex(pattern) {
  return new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')}$`);
}

function matchRedirect(urlPath) {
  for (const rule of redirects) {
    const m = patternToRegex(rule.from).exec(urlPath);
    if (m) return { rule, splat: m[1] ?? '' };
  }
  return null;
}

async function proxy(req, res, rule) {
  const target = new URL(req.url, API);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (['host', 'connection', 'content-length'].includes(key)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  // A Netlify termina o TLS e informa o esquema do visitante ao backend.
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', req.headers.host ?? '');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
    redirect: 'manual',
  });
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key)) return;
    res.setHeader(key, value);
  });
  // O proxy da Netlify não deixa o backend definir Domain: o cookie nasce no
  // domínio da interface (primeira parte).
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    res.setHeader(
      'set-cookie',
      cookies.map((cookie) => cookie.replace(/;\s*domain=[^;]*/i, '')),
    );
  }
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveStatic(req, res, urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.join(DIST, relative || 'index.html');
  if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (/\.[a-z0-9]{2,5}$/i.test(urlPath)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const hit = matchRedirect(url.pathname);
  try {
    if (hit && hit.rule.to.startsWith('http')) {
      await proxy(req, res, hit.rule);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    res.writeHead(502).end(`proxy error: ${String(error)}`);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[sim] Netlify simulada em http://0.0.0.0:${PORT} → API ${API.origin}`));
