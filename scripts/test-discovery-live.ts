/**
 * Testes AO VIVO da descoberta: consultam os acervos reais (Europe PMC,
 * NCBI Bookshelf, OpenAlex e PubMed). Diferente de `npm run test:discovery`,
 * aqui NÃO existe mock de `fetch` — é preciso ter saída para a internet.
 *
 * Execução:
 *   npm run test:discovery:live
 *   npm run test:discovery:live -- --query="sepse"
 *   npm run test:discovery:live -- --providers=europepmc,pubmed
 *   npm run test:discovery:live -- --skip-import
 *   npm run test:discovery:live -- --probe      (só testa a conectividade)
 *
 * Ambiente sem internet (CI offline, sandbox de preview): o script avisa e
 * encerra com código 1 sem rodar os testes — use o suite offline nesse caso.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.tmp', 'test-discovery-live');
process.env.DATA_DIR = DATA_DIR;
fs.rmSync(DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const args = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const found = args.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
};

const QUERY = (argValue('query') ?? 'sepsis').trim();
const ONLY = (argValue('providers') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const SKIP_IMPORT = args.includes('--skip-import');
const PROBE_ONLY = args.includes('--probe');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Testes ao vivo da descoberta (consultam os acervos reais).
Uso: npm run test:discovery:live -- [opções]

  --query=<termo>        termo buscado nos acervos (padrão: sepsis)
  --providers=<lista>    limita os acervos: europepmc,bookshelf,openalex,pubmed
  --skip-import          pula o fluxo material → análise → casos
  --probe                apenas verifica a conectividade com cada acervo
  -h, --help             mostra esta ajuda`);
  process.exit(0);
}

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: string): void {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function ms(start: number): string {
  return `${Date.now() - start} ms`;
}

const HOSTS = [
  { id: 'europepmc', label: 'Europe PMC', url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=sepsis&format=json&pageSize=1' },
  { id: 'bookshelf', label: 'NCBI Bookshelf', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=books&term=sepsis&retmode=json&retmax=1' },
  { id: 'openalex', label: 'OpenAlex', url: 'https://api.openalex.org/works?search=sepsis&per-page=1' },
  { id: 'pubmed', label: 'PubMed', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=sepsis&retmode=json&retmax=1' },
];

async function probe(url: string): Promise<{ ok: boolean; status?: number; detail?: string; elapsed: number }> {
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    return { ok: response.ok, status: response.status, elapsed: Date.now() - start };
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, detail, elapsed: Date.now() - start };
  }
}

async function main() {
  console.log(`\n# Testes ao vivo da descoberta — termo: "${QUERY}"${ONLY.length ? ` · acervos: ${ONLY.join(', ')}` : ''}`);

  console.log('\n# Conectividade');
  const probes = await Promise.all(HOSTS.map(async (host) => ({ host, result: await probe(host.url) })));
  for (const { host, result } of probes) {
    console.log(
      `  ${result.ok ? 'ok  ' : 'FAIL'} ${host.label.padEnd(16)} ${result.status ?? result.detail} (${result.elapsed} ms)`,
    );
  }
  const reachable = probes.filter((entry) => entry.result.ok).map((entry) => entry.host.id);

  if (PROBE_ONLY) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(`\n${reachable.length}/${probes.length} acervo(s) acessível(is): ${reachable.join(', ') || 'nenhum'}`);
    process.exit(reachable.length === probes.length ? 0 : 1);
  }

  if (reachable.length === 0) {
    console.error(
      '\nSem saída para a internet neste ambiente — nenhum acervo respondeu.\n' +
        'Este suite consulta as APIs reais e precisa de rede. Use `npm run test:discovery` (offline, com fixtures)\n' +
        'ou rode `npm run test:discovery:live` numa máquina/CI com acesso à internet.',
    );
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(1);
  }

  const { assertPublicUrl } = await import('../server/discovery/http');
  const { europePmcProvider } = await import('../server/discovery/providers/europepmc');
  const { pubmedProvider } = await import('../server/discovery/providers/pubmed');
  const { openAlexProvider } = await import('../server/discovery/providers/openalex');
  const { bookshelfProvider } = await import('../server/discovery/providers/bookshelf');
  const { searchRepositories, providerCatalog } = await import('../server/discovery');
  const { fetchFromUrl } = await import('../server/discovery/providers/url');
  const { storeSource } = await import('../server/sources/store');
  const { generateForSource } = await import('../server/generation/service');
  const { run, db } = await import('../server/db');
  const { nowIso } = await import('../server/util');
  const discoveryTypes = await import('../server/discovery/types');

  const shouldRun = (id: string) => (ONLY.length > 0 ? ONLY.includes(id) : true);

  console.log('\n# Segurança (SSRF, sem rede)');
  for (const blocked of ['http://127.0.0.1/x', 'http://localhost:3000', 'http://10.0.0.5/prontuario', 'file:///etc/passwd']) {
    let threw = false;
    try {
      assertPublicUrl(blocked);
    } catch (error) {
      threw = error instanceof discoveryTypes.DiscoveryError && error.status === 400;
    }
    check(`bloqueia ${blocked}`, threw);
  }

  const options = { limit: 3, onlyOpenAccess: false };

  const runProvider = async (
    id: string,
    label: string,
    provider: typeof europePmcProvider,
    validate: (results: Awaited<ReturnType<typeof europePmcProvider.search>>) => string | null,
  ) => {
    if (!shouldRun(id)) return [];
    if (!reachable.includes(id)) {
      check(`${label} responde`, false, 'host inacessível na verificação de conectividade');
      return [];
    }
    console.log(`\n# ${label}`);
    const start = Date.now();
    try {
      const results = await provider.search(QUERY, options);
      const problem = validate(results);
      check(`${label}: busca retorna resultados`, results.length > 0, `${results.length} em ${ms(start)}`);
      if (problem) check(`${label}: ${problem}`, false);
      else if (results.length > 0) check(`${label}: registros com título, id e origem`, true, results[0].title.slice(0, 70));
      return results;
    } catch (error) {
      check(`${label}: busca responde`, false, error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  const epmc = await runProvider('europepmc', 'Europe PMC', europePmcProvider, (results) =>
    results.every((item) => Boolean(item.id && item.title)) ? null : 'registro sem id/título',
  );
  const books = await runProvider('bookshelf', 'NCBI Bookshelf', bookshelfProvider, (results) =>
    results.every((item) => Boolean(item.id && item.title)) ? null : 'registro sem id/título',
  );
  const openalex = await runProvider('openalex', 'OpenAlex', openAlexProvider, (results) =>
    results.every((item) => Boolean(item.id && item.title)) ? null : 'registro sem id/título',
  );
  const pubmed = await runProvider('pubmed', 'PubMed', pubmedProvider, (results) =>
    results.every((item) => Boolean(item.id && item.title)) ? null : 'registro sem id/título',
  );

  if (epmc.length > 0) {
    console.log('\n# Europe PMC: texto');
    try {
      const abstract = await europePmcProvider.fetchText(epmc[0], 'abstract');
      check('resumo do Europe PMC tem texto', abstract.text.length > 150, `${abstract.text.length} caracteres · ${abstract.quality}`);
      if (epmc[0].hasFullText) {
        const full = await europePmcProvider.fetchText(epmc[0], 'fulltext');
        check('texto completo (JATS) convertido', full.text.length > 500, `${full.text.length} caracteres · ${full.quality}`);
        check('texto completo preserva seções', /^##\s/m.test(full.text));
      } else {
        console.log('  (primeiro resultado sem texto aberto — etapa de texto completo pulada)');
      }
    } catch (error) {
      check('texto do Europe PMC acessível', false, error instanceof Error ? error.message : String(error));
    }
  }

  if (books.length > 0) {
    console.log('\n# NCBI Bookshelf: texto');
    try {
      const chapter = await bookshelfProvider.fetchText(books[0], 'fulltext');
      check('capítulo do Bookshelf tem texto', chapter.text.length > 500, `${chapter.text.length} caracteres`);
      check('capítulo preserva títulos', /^#/m.test(chapter.text));
    } catch (error) {
      check('capítulo do Bookshelf acessível', false, error instanceof Error ? error.message : String(error));
    }
  }

  if (pubmed.length > 0) {
    console.log('\n# PubMed: texto');
    try {
      const abstract = await pubmedProvider.fetchText(pubmed[0], 'abstract');
      check('resumo do PubMed tem texto', abstract.text.length > 80, `${abstract.text.length} caracteres`);
    } catch (error) {
      check('resumo do PubMed acessível', false, error instanceof Error ? error.message : String(error));
    }
  }

  if (openalex.length > 0) {
    const withAbstract = openalex.filter((item) => (item.abstract ?? '').length > 60);
    check('OpenAlex reconstrói ao menos um resumo', withAbstract.length > 0, `${withAbstract.length}/${openalex.length}`);
  }

  console.log('\n# Busca agregada');
  const selected = ['europepmc', 'pubmed', 'openalex', 'bookshelf'].filter((id) => shouldRun(id) && reachable.includes(id));
  if (selected.length > 0) {
    const start = Date.now();
    const aggregated = await searchRepositories(QUERY, selected, { limit: 3, onlyOpenAccess: false });
    const okStatuses = aggregated.statuses.filter((status) => status.ok);
    check('busca agregada consulta os acervos', aggregated.statuses.length === selected.length, `${aggregated.statuses.length}/${selected.length}`);
    check('nenhum acervo falhou', okStatuses.length === aggregated.statuses.length, aggregated.statuses.filter((s) => !s.ok).map((s) => `${s.id}: ${s.message}`).join(' | '));
    check('resultados têm provedor válido', aggregated.results.every((item) => selected.includes(item.provider)), `${aggregated.results.length} resultados em ${ms(start)}`);
    const anonymous = await searchRepositories(QUERY, ['local', ...selected], { limit: 3, onlyOpenAccess: false });
    check('busca sem login ignora a biblioteca pessoal', !anonymous.statuses.some((status) => status.id === 'local'));
  }

  if (shouldRun('url')) {
    console.log('\n# Importação por link');
    try {
      const page = await fetchFromUrl('https://example.com');
      check('baixa e limpa uma página pública', page.text.toLowerCase().includes('example domain'), `${page.text.length} caracteres`);
    } catch (error) {
      check('importação por link funciona', false, error instanceof Error ? error.message : String(error));
    }
  }

  if (!SKIP_IMPORT && epmc.length > 0) {
    console.log('\n# Fluxo completo: acervo → material → análise → casos');
    try {
      const user = run(
        'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
        'Teste ao vivo',
        'live@studyflux.test',
        'x',
        'student',
        nowIso(),
      );
      const userId = Number(user.lastInsertRowid);
      const fetched = epmc[0].hasFullText
        ? await europePmcProvider.fetchText(epmc[0], 'fulltext')
        : await europePmcProvider.fetchText(epmc[0], 'abstract');
      check('material com texto utilizável', fetched.text.length > 300, `${fetched.text.length} caracteres · ${fetched.quality}`);
      const stored = storeSource(userId, { title: fetched.title, text: fetched.text, extraWarnings: fetched.notes });
      check('material analisado', stored.row.status === 'pronto', `${stored.analysis.sections.length} seções`);
      const outcome = await generateForSource(userId, stored.row, { mode: 'estruturado', maxCases: 3, publish: true });
      check('casos gerados a partir do conteúdo real', outcome.created + outcome.updated > 0, `criados=${outcome.created} · atualizados=${outcome.updated}`);
    } catch (error) {
      check('fluxo completo', false, error instanceof Error ? error.message : String(error));
    }
  }

  const catalog = providerCatalog(true);
  check('catálogo lista os cinco acervos', catalog.length === 5, catalog.map((item) => item.id).join(', '));

  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  console.log(`\n${checks - failures}/${checks} verificações passaram (ao vivo).`);
  if (failures > 0) {
    console.error(`${failures} falha(s). Veja os detalhes acima.`);
    process.exit(1);
  }
  console.log('Conexão externa liberada: os quatro acervos responderam.');
}

main().catch((error) => {
  console.error('Erro no teste ao vivo:', error);
  process.exit(1);
});
