/**
 * Smoke test da interface Angular sem navegador: sobe o HTML compilado em
 * jsdom, executa o bundle de verdade e confere o texto renderizado em cada rota.
 *
 * Uso: `npm run build` antes e, com o servidor no ar (`npm start`), rode
 * `npm run test:web`. Precisa da conta demo (SEED_DEMO=1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173';
const DIST = path.join(process.cwd(), 'web', 'dist');
const INDEX = path.join(DIST, 'index.html');

if (!fs.existsSync(INDEX)) {
  console.error('[smoke] web/dist/index.html não encontrado — rode `npm run build` antes.');
  process.exit(1);
}

const html = fs.readFileSync(INDEX, 'utf8');
const bundle = html.match(/<script src="([^"]+)" type="module"><\/script>/)?.[1];
if (!bundle) {
  console.error('[smoke] bundle JS não encontrado no index.html.');
  process.exit(1);
}
const bundleUrl = pathToFileURL(path.join(DIST, bundle)).href;

const nodeFetch = globalThis.fetch;
const jar = new Map();
const cookies = () => [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');

function absolute(input) {
  return typeof input === 'string' ? new URL(input, BASE).toString() : (input?.url ?? String(input));
}

async function httpFetch(input, init = {}) {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  const cookie = cookies();
  if (cookie) headers.set('cookie', cookie);
  const response = await nodeFetch(absolute(input), {
    method: init.method ?? (input instanceof Request ? input.method : 'GET'),
    headers,
    body: init.body,
    redirect: 'manual',
  });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return response;
}

const consoleErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => consoleErrors.push(String(error?.message ?? error)));
virtualConsole.on('error', (...args) => consoleErrors.push(args.map(String).join(' ')));

const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'customElements', 'CSS',
  'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Node', 'Text', 'Event',
  'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'InputEvent', 'FormData', 'File', 'Blob', 'requestAnimationFrame',
  'cancelAnimationFrame', 'getComputedStyle', 'MutationObserver', 'MessageChannel', 'IntersectionObserver',
  'ResizeObserver', 'DocumentFragment', 'Comment',
];

let version = 0;

async function render(route, action) {
  version += 1;
  const dom = new JSDOM(html.replace(/<script src="[^"]+" type="module"><\/script>/, ''), {
    url: BASE + route,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = httpFetch;
  window.scrollTo = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const key of GLOBALS) {
    if (!(key in window)) continue;
    try {
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
    } catch {
      /* navigator e performance são somente leitura no Node */
    }
  }
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.self = window;
  globalThis.fetch = httpFetch;

  await import(`${bundleUrl}?v=${version}`);

  const started = Date.now();
  while (Date.now() - started < 8000) {
    await sleep(120);
    if (!text(window).endsWith('Carregando…')) break;
  }
  await sleep(400);
  if (action) {
    await action(window);
    await sleep(1200);
  }
  const body = text(window);
  window.close();
  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (window) => (window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();

const CHECKS = [
  { route: '/', expect: ['Meta diária', 'Questões respondidas'] },
  { route: '/casos', expect: ['Biblioteca de casos'] },
  { route: '/materiais', expect: ['Materiais de estudo'] },
  { route: '/progresso', expect: ['Seu progresso'] },
  { route: '/revisao', expect: ['cards'] },
  { route: '/simulado', expect: ['Simulado', 'Configurar simulado'] },
  { route: '/configuracoes', expect: ['Configurações', 'Geração por IA'] },
  { route: '/descobrir', expect: ['Descobrir conteúdo', 'Acervos científicos'] },
  { route: '/casos/novo', expect: ['Novo caso clínico', 'Perguntas (1)'] },
];

const failures = [];
let passed = 0;
const total = CHECKS.length + 1;

const login = await httpFetch('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'demo@studyflux.app', password: 'estudar123' }),
});
if (login.status !== 200) {
  console.error(`[smoke] não foi possível entrar na conta demo (HTTP ${login.status}). ` +
    'O servidor está no ar com SEED_DEMO=1?');
  process.exit(1);
}

for (const check of CHECKS) {
  const body = await render(check.route);
  const missing = check.expect.filter((term) => !body.includes(term));
  if (missing.length === 0) {
    passed += 1;
    console.log(`✔ ${check.route}`);
  } else {
    failures.push(`${check.route}: faltando ${missing.join(', ')}`);
    console.log(`✘ ${check.route} — faltando ${missing.join(', ')}`);
  }
}

// Fluxo de treino: escolhe a primeira alternativa e confirma a resposta.
const cases = await httpFetch('/api/cases?limit=1&mine=1').then((response) => response.json());
const trainingCase = cases.cases?.[0];
if (trainingCase) {
  const body = await render(`/treinar/${trainingCase.id}`, async (window) => {
    const click = (element) => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const option = window.document.querySelector('button.option');
    if (option) click(option);
    await sleep(150);
    const confirm = [...window.document.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Confirmar resposta'),
    );
    if (confirm) click(confirm);
  });
  const feedback = body.includes('Resposta correta') || body.includes('Resposta incorreta');
  if (feedback) {
    passed += 1;
    console.log('✔ treino (responder e ver feedback)');
  } else {
    failures.push('treino: feedback não apareceu depois de confirmar');
    console.log('✘ treino — feedback não apareceu');
  }
}

if (consoleErrors.length > 0) {
  failures.push(`erros no console: ${consoleErrors.slice(0, 3).join(' | ')}`);
}

console.log(`\n[smoke] ${passed}/${total} verificações ok`);
if (failures.length > 0) {
  console.error('[smoke] falhas:\n - ' + failures.join('\n - '));
  process.exit(1);
}
process.exit(0);
