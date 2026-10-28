/**
 * Testes do módulo de descoberta (sem internet).
 * Intercepta o fetch global com fixtures no formato real de cada acervo,
 * valida os parsers, a geração estruturada a partir de resumo e o fluxo completo
 * (importar → analisar → gerar casos) contra um banco temporário.
 *
 * Execução: npm run test:discovery
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.tmp', 'test-discovery');
process.env.DATA_DIR = DATA_DIR;
fs.rmSync(DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: string): void {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ------------------------------- fixtures ------------------------------- */

const EUROPE_PMC_SEARCH = {
  hitCount: 2,
  resultList: {
    result: [
      {
        id: '39612345',
        source: 'MED',
        pmid: '39612345',
        pmcid: 'PMC7654321',
        doi: '10.1000/sepse.2024',
        title: 'Early antibiotics and fluid resuscitation in sepsis: a pragmatic review',
        authorString: 'Souza AB, Lima CD, Ferreira EF, Almeida GH',
        journalTitle: 'Revista Brasileira de Terapia Intensiva',
        pubYear: '2024',
        abstractText:
          'Sepsis is a life-threatening organ dysfunction caused by a dysregulated host response to infection. Early antibiotic therapy within the first hour and adequate fluid resuscitation are associated with lower mortality.',
        isOpenAccess: 'Y',
        license: 'cc by',
        pubType: 'review',
        citedByCount: 42,
        language: 'eng',
      },
      {
        id: 'PRE123456',
        source: 'PPR',
        title: 'Sepsis biomarkers in the emergency department (preprint)',
        authorString: 'Oliveira IJ',
        pubYear: '2025',
        abstractText: 'We evaluated lactate clearance as a prognostic marker in the emergency department.',
        isOpenAccess: 'N',
        pubType: 'preprint',
        language: 'eng',
      },
    ],
  },
};

const EUROPE_PMC_FULLTEXT = `<?xml version="1.0" encoding="UTF-8"?>
<article>
  <front><article-title>Early antibiotics and fluid resuscitation in sepsis</article-title></front>
  <body>
    <sec><title>Introduction</title><p>Sepsis is a life-threatening organ dysfunction caused by a dysregulated host response to infection.</p></sec>
    <sec><title>Diagnosis</title><p>Blood cultures should be collected before antibiotics when this does not delay treatment. Serum lactate is a marker of hypoperfusion.</p></sec>
    <sec><title>Treatment</title><p>Broad-spectrum antibiotics should be started within the first hour. Crystalloid resuscitation with 30 mL/kg is recommended for hypotension. Norepinephrine is the vasopressor of choice when mean arterial pressure remains below 65 mmHg after adequate fluids.</p></sec>
    <sec><title>Epidemiology</title><p>Sepsis affects millions of patients worldwide every year and is a leading cause of death in intensive care units. The incidence is higher in low- and middle-income countries and among elderly patients with comorbidities.</p></sec>
    <sec><title>Complications</title><p>Acute kidney injury, acute respiratory distress syndrome and septic shock are frequent complications. Long-term cognitive impairment and physical deconditioning are common after discharge.</p></sec>
    <sec><title>Prevention</title><p>Early recognition, vaccination, hand hygiene and appropriate use of antibiotics reduce the burden of sepsis in hospitals and in the community.</p></sec>
    <ref-list><ref><mixed-citation>WHO. Sepsis guidelines. 2024.</mixed-citation></ref></ref-list>
  </body>
</article>`;

const PUBMED_ESEARCH = { esearchresult: { idlist: ['39000001', '39000002'], count: '2' } };

const PUBMED_EFETCH = `<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">39000001</PMID>
      <Article>
        <Journal><Title>Revista de Pediatria</Title></Journal>
        <ArticleTitle>Bronchiolitis in infants: current management</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Bronchiolitis is the most common lower respiratory infection in infants.</AbstractText>
          <AbstractText Label="METHODS">We reviewed 120 infants admitted with bronchiolitis.</AbstractText>
        </Abstract>
        <AuthorList><Author><LastName>Silva</LastName><Initials>RS</Initials></Author></AuthorList>
        <Language>por</Language>
        <PublicationTypeList><PublicationType>Review</PublicationType></PublicationTypeList>
        <PubDate><Year>2023</Year></PubDate>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/ped.2023.001</ArticleId></ArticleIdList></PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">39000002</PMID>
      <Article>
        <Journal><Title>Revista de Cardiologia</Title></Journal>
        <ArticleTitle>Heart failure with reduced ejection fraction</ArticleTitle>
        <Abstract><AbstractText>Angiotensin receptor blockers reduce mortality in heart failure.</AbstractText></Abstract>
        <AuthorList><Author><LastName>Costa</LastName><Initials>MP</Initials></Author></AuthorList>
        <Language>por</Language>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
        <PubDate><Year>2022</Year></PubDate>
      </Article>
    </MedlineCitation>
    <PubmedData><ArticleIdList /></PubmedData>
  </PubmedArticle>
</PubmedArticleSet>`;

const OPENALEX_SEARCH = {
  results: [
    {
      id: 'https://openalex.org/W123456789',
      doi: 'https://doi.org/10.1000/aberto.2024',
      display_name: 'Sepsis epidemiology in Brazil: a cohort study',
      publication_year: 2024,
      language: 'pt',
      abstract_inverted_index: {
        Sepsis: [0],
        is: [1],
        frequent: [2],
        in: [3],
        intensive: [4],
        care: [5],
        units: [6],
        and: [7],
        mortality: [8],
        remains: [9],
        high: [10],
      },
      authorships: [{ author: { display_name: 'Ana Ribeiro' } }, { author: { display_name: 'Bruno Teixeira' } }],
      primary_location: { source: { display_name: 'Revista Brasileira de Terapia Intensiva' }, pdf_url: null, landing_page_url: null },
      best_oa_location: { pdf_url: 'https://example.org/artigo.pdf', landing_page_url: 'https://example.org/artigo' },
      open_access: { is_oa: true, oa_url: 'https://example.org/artigo' },
      type: 'article',
    },
  ],
};

const BOOKSHELF_ESEARCH = { esearchresult: { idlist: ['NBK430862'], count: '1' } };
const BOOKSHELF_ESUMMARY = {
  result: {
    NBK430862: {
      uid: 'NBK430862',
      title: 'Sepsis: StatPearls',
      authors: [{ name: 'Mendes L' }],
      publisher: 'StatPearls Publishing',
      pubdate: '2024',
      lang: ['eng'],
    },
  },
};
const BOOKSHELF_EFETCH = `<?xml version="1.0"?>
<book-part>
  <body>
    <sec><title>Definition</title><p>Sepsis is life-threatening organ dysfunction caused by a dysregulated host response to infection.</p></sec>
    <sec><title>Clinical presentation</title><p>Patients may present with fever, tachycardia, hypotension and altered mental status.</p></sec>
    <sec><title>Treatment</title><p>Initiate broad-spectrum antibiotics within one hour and give intravenous fluids for hypotension. Norepinephrine should be started when hypotension persists despite adequate fluid resuscitation.</p></sec>
    <sec><title>Epidemiology</title><p>Sepsis is a major cause of morbidity and mortality in hospitalized patients, with higher incidence in elderly individuals and in patients with chronic diseases.</p></sec>
    <sec><title>Diagnosis</title><p>The diagnosis requires suspected infection plus organ dysfunction. Blood cultures, lactate measurement and imaging help to identify the source of infection.</p></sec>
    <sec><title>Prognosis</title><p>Mortality ranges from 10 percent in uncomplicated cases to more than 40 percent in septic shock. Early recognition and treatment improve survival.</p></sec>
    <ref-list><ref><p>Reference to be removed.</p></ref></ref-list>
  </body>
</book-part>`;

/* ------------------------------ fetch mock ------------------------------ */

type Route = (url: string) => { status?: number; body: string; contentType: string } | null;

const routes: Route = (url) => {
  if (url.includes('ebi.ac.uk/europepmc') && url.includes('/search')) {
    return { body: JSON.stringify(EUROPE_PMC_SEARCH), contentType: 'application/json' };
  }
  if (url.includes('ebi.ac.uk/europepmc') && url.includes('/fullTextXML')) {
    return { body: EUROPE_PMC_FULLTEXT, contentType: 'application/xml' };
  }
  if (url.includes('esearch.fcgi') && url.includes('db=pubmed')) {
    return { body: JSON.stringify(PUBMED_ESEARCH), contentType: 'application/json' };
  }
  if (url.includes('esearch.fcgi') && url.includes('db=books')) {
    return { body: JSON.stringify(BOOKSHELF_ESEARCH), contentType: 'application/json' };
  }
  if (url.includes('esummary.fcgi') && url.includes('db=books')) {
    return { body: JSON.stringify(BOOKSHELF_ESUMMARY), contentType: 'application/json' };
  }
  if (url.includes('efetch.fcgi') && url.includes('db=pubmed')) {
    return { body: PUBMED_EFETCH, contentType: 'application/xml' };
  }
  if (url.includes('efetch.fcgi') && url.includes('db=books')) {
    return { body: BOOKSHELF_EFETCH, contentType: 'application/xml' };
  }
  if (url.includes('api.openalex.org')) {
    return { body: JSON.stringify(OPENALEX_SEARCH), contentType: 'application/json' };
  }
  return { status: 404, body: 'not mocked', contentType: 'text/plain' };
};

const originalFetch = globalThis.fetch;
const requestedUrls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  requestedUrls.push(url);
  const route = routes(url);
  if (!route) throw new Error(`URL não mapeada no teste: ${url}`);
  return new Response(route.body, {
    status: route.status ?? 200,
    headers: { 'content-type': route.contentType },
  });
}) as typeof fetch;

/* --------------------------------- testes -------------------------------- */

async function main() {
  const { assertPublicUrl, htmlToText, jatsToText } = await import('../server/discovery/http');
  const { europePmcProvider } = await import('../server/discovery/providers/europepmc');
  const { pubmedProvider } = await import('../server/discovery/providers/pubmed');
  const { openAlexProvider } = await import('../server/discovery/providers/openalex');
  const { bookshelfProvider } = await import('../server/discovery/providers/bookshelf');
  const { searchRepositories } = await import('../server/discovery');
  const { storeSource } = await import('../server/sources/store');
  const { generateForSource } = await import('../server/generation/service');
  const { analyzeSource } = await import('../server/ingestion/analyze');
  const { generateStructured } = await import('../server/generation/structured');
  const { run, get, db } = await import('../server/db');
  const { nowIso } = await import('../server/util');

  console.log('\n# Segurança (SSRF)');
  for (const blocked of ['http://127.0.0.1/x', 'http://localhost:3000', 'http://10.0.0.5/prontuario', 'file:///etc/passwd', 'http://192.168.0.10/']) {
    let threw = false;
    try {
      assertPublicUrl(blocked);
    } catch {
      threw = true;
    }
    check(`bloqueia ${blocked}`, threw);
  }
  let allowed = true;
  try {
    assertPublicUrl('https://pubmed.ncbi.nlm.nih.gov/123/');
  } catch {
    allowed = false;
  }
  check('permite URL pública https', allowed);

  console.log('\n# Conversão de markup');
  const html = '<html><head><style>x{}</style></head><body><nav>menu</nav><h1>Sepse</h1><p>Definição <b>clínica</b>.</p><script>alert(1)</script></body></html>';
  const htmlText = htmlToText(html);
  check('HTML mantém título como seção', htmlText.includes('## Sepse'));
  check('HTML remove script/style/nav', !htmlText.includes('alert') && !htmlText.includes('x{}') && !htmlText.includes('menu'));
  const jats = jatsToText(EUROPE_PMC_FULLTEXT);
  check('JATS preserva seções', jats.includes('## Treatment'), jats.slice(0, 120));
  check('JATS remove referências', !jats.includes('WHO. Sepsis guidelines'));

  console.log('\n# Europe PMC');
  const epmc = await europePmcProvider.search('sepse', { limit: 5, onlyOpenAccess: false });
  check('retorna 2 resultados', epmc.length === 2, String(epmc.length));
  check('identifica acesso aberto e PMCID', epmc[0]?.openAccess === true && epmc[0]?.hasFullText === true);
  check('autorstring vira lista', epmc[0]?.authors.length === 4);
  const epmcFull = await europePmcProvider.fetchText(epmc[0], 'fulltext');
  check('texto completo JATS importado', epmcFull.quality === 'texto_completo' && epmcFull.text.includes('Broad-spectrum antibiotics'), epmcFull.text.slice(0, 80));
  let blockedNonOA = false;
  try {
    await europePmcProvider.fetchText(epmc[1], 'fulltext');
  } catch {
    blockedNonOA = true;
  }
  check('não tenta texto completo de não-OA', blockedNonOA);
  const epmcAbstract = await europePmcProvider.fetchText(epmc[1], 'abstract');
  check('usa resumo quando não há texto completo', epmcAbstract.quality === 'resumo' && epmcAbstract.text.includes('We evaluated lactate'));

  console.log('\n# PubMed');
  const pubmed = await pubmedProvider.search('bronquiolite', { limit: 5, onlyOpenAccess: false });
  check('retorna 2 registros', pubmed.length === 2, String(pubmed.length));
  check(
    'junta seções do resumo',
    Boolean(pubmed[0]?.abstract?.includes('most common lower respiratory infection') && pubmed[0]?.abstract?.includes('reviewed 120 infants')),
    pubmed[0]?.abstract ?? '',
  );
  check('extrai ano, revista e DOI', pubmed[0]?.year === '2023' && pubmed[0]?.journal === 'Revista de Pediatria' && pubmed[0]?.doi === '10.1000/ped.2023.001');

  console.log('\n# OpenAlex');
  const openalex = await openAlexProvider.search('sepse', { limit: 5, onlyOpenAccess: true });
  check('reconstrói resumo invertido', Boolean(openalex[0]?.abstract?.startsWith('Sepsis is frequent in intensive care units')), openalex[0]?.abstract ?? '');
  check('detecta PDF aberto', openalex[0]?.hasFullText === true && String(openalex[0]?.extra?.pdfUrl).endsWith('.pdf'));

  console.log('\n# NCBI Bookshelf');
  const books = await bookshelfProvider.search('sepsis', { limit: 3, onlyOpenAccess: false });
  check('retorna capítulo', books.length === 1 && books[0]?.type === 'capitulo', String(books.length));
  const bookText = await bookshelfProvider.fetchText(books[0], 'fulltext');
  check('texto do capítulo com seções', bookText.text.includes('## Treatment') && bookText.text.includes('## Definition'));
  check('remove referências do capítulo', !bookText.text.includes('Reference to be removed'));

  console.log('\n# Busca agregada');
  const aggregated = await searchRepositories('sepse', ['europepmc', 'pubmed', 'openalex', 'bookshelf'], { limit: 5, onlyOpenAccess: false, userId: 1 });
  check('agrega resultados de todos os acervos', aggregated.results.length === 2 + 2 + 1 + 1, String(aggregated.results.length));
  check('todos os provedores responderam ok', aggregated.statuses.every((status) => status.ok), JSON.stringify(aggregated.statuses));
  const cached = await searchRepositories('sepse', ['europepmc', 'pubmed', 'openalex', 'bookshelf'], { limit: 5, onlyOpenAccess: false, userId: 1 });
  check('usa cache na segunda busca', cached.cached === true);

  console.log('\n# Busca pública (sem login)');
  const { providerCatalog } = await import('../server/discovery');
  check('catálogo de visitante esconde a biblioteca', !providerCatalog(false).some((provider) => provider.id === 'local'));
  check('catálogo autenticado inclui a biblioteca', providerCatalog(true).some((provider) => provider.id === 'local'));
  const guest = await searchRepositories('sepse', ['local', 'europepmc'], { limit: 3, onlyOpenAccess: false });
  check(
    'visitante não consulta biblioteca pessoal',
    !guest.statuses.some((status) => status.id === 'local'),
    guest.statuses.map((status) => status.id).join(', '),
  );
  check(
    'visitante recebe resultados dos acervos externos',
    guest.results.length === 2 && guest.statuses.every((status) => status.ok),
    `${guest.results.length} resultados`,
  );

  console.log('\n# Resumo → casos (modo estruturado)');
  const abstractText = `${epmcAbstract.text}\n\n${openalex[0]?.abstract ?? ''}`;
  const parsedAbstract = analyzeSource(abstractText, 'Sepsis review', null);
  const casesFromAbstract = generateStructured(parsedAbstract, 'Sepsis review');
  const totalQuestions = casesFromAbstract.reduce((acc, item) => acc + item.content.questions.length, 0);
  check('gera casos a partir de um resumo', casesFromAbstract.length >= 1, `casos=${casesFromAbstract.length}`);
  check('cada caso tem 2+ perguntas', casesFromAbstract.every((item) => item.content.questions.length >= 2), `perguntas=${totalQuestions}`);

  console.log('\n# Fluxo completo: importar → analisar → gerar');
  const user = run('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)', 'Teste', 'teste@studyflux.app', 'x', 'student', nowIso());
  const userId = Number(user.lastInsertRowid);
  const stored = storeSource(userId, {
    title: epmcFull.title,
    text: epmcFull.text,
    extraWarnings: epmcFull.notes,
  });
  check('material importado e analisado', stored.row.status === 'pronto' && stored.analysis.sections.length > 0, JSON.stringify(stored.analysis.warnings));
  check('análise reconhece temas', stored.analysis.topics.length > 0, stored.analysis.topics.join(', '));
  const outcome = await generateForSource(userId, stored.row, { mode: 'estruturado', maxCases: 3, publish: true });
  check('casos gerados e publicados', outcome.created + outcome.updated > 0, JSON.stringify(outcome));
  const persisted = get<{ n: number }>("SELECT COUNT(*) AS n FROM cases WHERE user_id = ? AND status = 'publicado'", userId);
  check('casos salvos no banco', (persisted?.n ?? 0) > 0, String(persisted?.n));
  const second = await generateForSource(userId, stored.row, { mode: 'estruturado', maxCases: 3, publish: true });
  check('regerar atualiza em vez de duplicar', second.created === 0 && second.updated > 0, JSON.stringify(second));

  console.log('\n# Resiliência de rede');
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const offline = await searchRepositories('sepse', ['europepmc'], { limit: 3, onlyOpenAccess: false, userId });
  check('erro de rede vira status tratado', offline.statuses[0]?.ok === false && Boolean(offline.statuses[0]?.message?.includes('conexão')));

  globalThis.fetch = originalFetch;
  db.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  console.log(`\n${checks - failures}/${checks} verificações passaram.`);
  console.log(`Requisições simuladas: ${requestedUrls.length}`);
  if (failures > 0) {
    console.error(`${failures} falha(s).`);
    process.exit(1);
  }
}

main().catch((error) => {
  globalThis.fetch = originalFetch;
  console.error('Erro no teste:', error);
  process.exit(1);
});
