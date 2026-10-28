/**
 * Pré-voo do deploy na Netlify: roda depois do build e ANTES de publicar,
 * conferindo os erros que passam em silêncio e só aparecem como "site fora do
 * ar" para o aluno.
 *
 * Verifica:
 *   - o diretório publicado (`web/dist`) existe e tem `index.html`;
 *   - o `index.html` tem `<base href="/">`;
 *   - o `netlify.toml` tem a regra de proxy `/api/*` apontando para um https;
 *   - a regra do proxy vem ANTES do fallback da SPA (a primeira que casa vence);
 *   - o destino do proxy não ficou no placeholder `SEU-BACKEND`.
 *
 * O placeholder é fatal só dentro da Netlify (`NETLIFY=true`, que ela define no
 * build); na máquina local ele apenas avisa, para não atrapalhar o dia a dia.
 *
 * Uso: node scripts/netlify-preflight.mjs
 *      NETLIFY=true node scripts/netlify-preflight.mjs   # simula o build da Netlify
 */
import fs from 'node:fs';
import path from 'node:path';

const problems = [];
const warnings = [];
const notes = [];

function fail(message, detail) {
  problems.push(detail ? `${message}\n     → ${detail}` : message);
}

// --------------------------------------------------------------------------
// 1. Artefato do build
// --------------------------------------------------------------------------
const tomlPath = 'netlify.toml';
if (!fs.existsSync(tomlPath)) {
  fail('netlify.toml não encontrado na raiz do repositório.');
}
const toml = fs.existsSync(tomlPath) ? fs.readFileSync(tomlPath, 'utf8') : '';

const publish = toml.match(/^\s*publish\s*=\s*"([^"]+)"/m)?.[1] ?? 'web/dist';
const indexFile = path.join(publish, 'index.html');
if (!fs.existsSync(indexFile)) {
  fail(
    `Diretório publicado (${publish}) sem index.html.`,
    'Rode `npm run build` antes; se o nome da pasta mudou, ajuste `publish` no netlify.toml.',
  );
} else {
  const html = fs.readFileSync(indexFile, 'utf8');
  if (!/<base\s[^>]*href="\/"/i.test(html)) {
    fail(
      '<base href="/"> ausente no index.html.',
      'Sem ele, abrir /casos/2 direto carrega assets pelo caminho errado e a página fica em branco.',
    );
  } else {
    notes.push(`build em ${publish} com <base href="/">`);
  }
}

// --------------------------------------------------------------------------
// 2. Ordem e destino das regras de redirect
// --------------------------------------------------------------------------
const rules = [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[\[|\n\[[a-z]|$)/g)].map((match) => {
  const block = match[1];
  return {
    from: block.match(/^\s*from\s*=\s*"([^"]+)"/m)?.[1] ?? '',
    to: block.match(/^\s*to\s*=\s*"([^"]+)"/m)?.[1] ?? '',
    status: Number(block.match(/^\s*status\s*=\s*(\d+)/m)?.[1] ?? 301),
  };
});

const apiIndex = rules.findIndex((rule) => rule.from.startsWith('/api'));
const spaIndex = rules.findIndex((rule) => rule.from === '/*' && /index\.html/.test(rule.to));

if (apiIndex < 0) {
  fail(
    'Sem regra de proxy para /api/*.',
    'A interface chama a API em /api; sem essa regra, toda chamada recebe o HTML do app.',
  );
} else {
  const api = rules[apiIndex];
  if (api.status !== 200) {
    fail(`Regra /api/* com status ${api.status}.`, 'Proxy exige status = 200 (200 é rewrite; 301/302 redireciona o navegador).');
  }
  if (!api.to.startsWith('https://')) {
    fail(`Destino do proxy não é https: ${api.to}`, 'A Netlify só faz proxy para https, e o cookie de sessão exige TLS.');
  }
  if (/SEU-BACKEND/i.test(api.to)) {
    const message = `O destino do proxy ainda é o placeholder (${api.to}).`;
    const detail = 'Troque por https://SEU-BACKEND.up.railway.app (ou o host da sua API), sem barra no final.';
    if (process.env.NETLIFY) fail(message, detail);
    else warnings.push(`${message} ${detail}`);
  } else {
    notes.push(`proxy /api/* → ${api.to.replace(/\/api\/:splat$/, '')}`);
  }
}

if (spaIndex < 0) {
  fail(
    'Sem fallback da SPA (/* → /index.html com status 200).',
    'Sem ele, recarregar /casos ou abrir um link direto devolve 404.',
  );
} else if (apiIndex >= 0 && spaIndex < apiIndex) {
  fail(
    'O fallback da SPA (/*) vem antes da regra /api/*.',
    'A Netlify aplica a primeira regra que casa, na ordem do arquivo: inverta as duas.',
  );
} else {
  notes.push('fallback da SPA depois do proxy');
}

// --------------------------------------------------------------------------
// Resultado
// --------------------------------------------------------------------------
for (const note of notes) console.log(`  ok   ${note}`);
for (const warning of warnings) console.log(`  aviso  ${warning}`);

if (problems.length > 0) {
  console.error('\n[netlify] deploy bloqueado — corrija antes de publicar:\n');
  for (const problem of problems) console.error(`  ✖  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('\n[netlify] configuração válida: interface estática + proxy da API.\n');
