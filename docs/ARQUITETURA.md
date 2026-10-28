# Arquitetura — Study Flux

Documento técnico: como a plataforma está montada, quais decisões foram tomadas, como operar e como evoluir.

---

## 1. Visão geral

```
┌──────────────────────────────┐        ┌──────────────────────────────────────────┐
│  React 19 + Router 7 (Vite)  │  /api  │  Express 5 + TypeScript (tsx)            │
│  web/src                     │ ─────▶ │  server/                                 │
└──────────────────────────────┘        │   ├─ ingestion  (extração + análise)     │
                                        │   ├─ generation (estruturado + IA)       │
                                        │   ├─ routes     (auth, sources, cases…)  │
                                        │   └─ srs        (SM-2)                   │
                                        └───────────────┬──────────────────────────┘
                                                        │ node:sqlite
                                                ┌───────▼────────┐
                                                │ data/studyflux.db │
                                                └────────────────┘
```

**Modo desenvolvimento:** Vite em `:5173` faz proxy de `/api` para o Express em `:8787`.
**Modo produção:** `npm run build` gera `web/dist`; `npm start` serve API e interface na mesma porta (`:8787`), com fallback de SPA.

### Decisões e justificativas

| Decisão | Alternativa descartada | Motivo |
| --- | --- | --- |
| **SQLite nativo (`node:sqlite`)** | Postgres + Docker | Zero setup para o aluno/professor rodar; arquivo único; migração para Postgres é simples (SQL padrão). |
| **Express 5 + tsx** | Next.js | O núcleo é API + SPA; Next traria SSR desnecessário e mais superfície de configuração. |
| **Tipos compartilhados** em `shared/types.ts` | Gerar client OpenAPI | Menos ferramentas, um único contrato para os dois lados. |
| **CSS próprio** | Tailwind/kit | Controle visual e identidade; sem dependência de build extra. |
| **Extração local (pdfjs/mammoth)** | Serviço de parsing | Privacidade e custo zero; funciona offline. |
| **Geração por regras + léxico** | Depender só de LLM | Disponibilidade, custo e fidelidade ao texto. |
| **Sessão por cookie httpOnly** | JWT no localStorage | Cookie httpOnly evita exposição a XSS; SameSite=Lax protege CSRF em requisições cross-site. |
| **Snapshot das respostas** | Só referenciar `question_id` | Histórico sobrevive a edição/exclusão do caso. |
| **React 19 + Vite** | Angular | Protótipo pequeno (13 telas, ~6 mil linhas), um desenvolvedor, CSS próprio: React tem menos cerimônia, bundle menor e um único comando de build. Angular seria melhor se o time crescesse (ver abaixo). |

### Por que React e não Angular

A escolha foi feita no início do projeto e **não houve consulta prévia** — vale registrar os dois lados, porque é uma decisão reversível.

**O que pesou a favor do React + Vite aqui**

- **Escala do projeto**: 13 telas, ~6 mil linhas, 8 dependências de runtime. Não há necessidade de estrutura imposta por framework.
- **Um comando**: `npm install && npm run dev`. Sem CLI, sem `angular.json`, sem `zone.js` — combina com a promessa de "o aluno roda na própria máquina".
- **Bundle**: 421 kB / ~123 kB gzip no total. Baseline do Angular standalone costuma somar algo entre 60 e 100 kB gzip.
- **CSS próprio** como design system: em Angular, o caminho natural seria Angular Material (visual genérico) ou carregar o mesmo CSS — nenhum ganho.
- **Tempo até o primeiro valor** importava mais que longevidade do front neste momento.

**O que Angular traria de melhor**

- **Formulários**: o editor de caso (perguntas + alternativas + gabarito) é o caso de uso ideal para Reactive Forms, com validação declarativa.
- **Convenções para equipe**: DI, módulos/serviços e estrutura fixa ajudam quando entra mais gente (professor, time de TI da faculdade) e o front precisa durar anos.
- **Bateria inclusa**: router, HTTP com interceptors, i18n, testes e acessibilidade (CDK) sem escolher biblioteca por biblioteca.
- **Ciclo de vida conhecido**: Angular 22 está ativo (suporte até 2027, LTS até 2028) — previsível para contexto corporativo.
- **Mercado enterprise no Brasil** (bancos, hospitais, governo) usa muito Angular; se o objetivo for empregabilidade nesse ecossistema, é um argumento legítimo.

**Se migrar, o custo é só no front**

O backend não muda: a API é REST/JSON e os DTOs vivem em `shared/types.ts`. Uma migração para Angular reescreve `web/src` (13 páginas + componentes + `lib/api.ts` e `lib/auth`) mantendo o mesmo contrato, e não dá para fazer de forma incremental dentro de um SPA — o normal é um branch paralelo, reaproveitando os tipos e o CSS. Estimativa honesta: dias de trabalho, não horas.

---

## 2. Requisitos e execução

- **Node.js 22+** (usa `node:sqlite`, estável no 22).
- Sem banco externo, sem Docker obrigatório.

```bash
npm install
npm run dev      # API :8787 + interface :5173
npm run build    # build da interface
npm start        # produção (API + interface em :8787)
npm run typecheck
npm run seed
npm run reset
```

Variáveis: `PORT`, `DATA_DIR`, `APP_SECRET`, `OPENALEX_MAILTO`, `TRUST_PROXY`, `SEED_DEMO`, `COOKIE_SECURE` (ver README e [DEPLOY.md](DEPLOY.md)). O banco e a conta demo são criados no primeiro start (`ensureSeeded`).

---

## 3. Estrutura de pastas

```
server/
  config.ts            caminhos, porta, segredo, limites
  db.ts                conexão SQLite, schema, migrações leves, helpers de query
  auth.ts              sessões, cookie, middleware de usuário
  settings.ts          preferências do usuário + criptografia da chave de IA
  srs.ts               algoritmo SM-2 e upsert de cards
  util.ts              hash de senha, AES-GCM, normalização de texto, CSV, cookies
  index.ts             composição do Express, estáticos, error handler
  ingestion/
    extract.ts         PDF (pdfjs), DOCX (mammoth), TXT/MD
    analyze.ts         seções, fatos, questões, gabarito, temas, tipo de material
    lexicon.ts         áreas, temas, condições e tipos de seção (PT-BR)
  discovery/
    types.ts           DTOs, contrato SourceProvider, DiscoveryError
    http.ts            fetch com timeout, limite de tamanho, guarda anti-SSRF, HTML/JATS/XML → texto
    index.ts           registro de acervos, busca agregada com cache, índice de resultados
    reference.ts       citação ABNT-ish da fonte (autor, ano, revista, DOI)
    providers/
      europepmc.ts pubmed.ts openalex.ts bookshelf.ts local.ts url.ts
  sources/
    store.ts           storeSource() — mesmo caminho para upload e descoberta
  generation/
    service.ts         generateForSource() + persistCases() (upsert por slug)
    structured.ts      gerador offline (cloze + provas antigas)
    cloze.ts           banco de termos por categoria e geração de alternativas
    llm.ts             provedores, prompt, chunking, sanitização, teste de conexão
  routes/
    auth.ts sources.ts cases.ts generate.ts attempts.ts srs.ts stats.ts settings.ts discovery.ts
    helpers.ts         mapeamento de linha → DTO
  seed/
    demoCases.ts demoUser.ts sampleSources.ts index.ts run.ts
shared/types.ts        contrato compartilhado (DTOs, enums, tipos de caso)
web/src/
  lib/                 api.ts, auth.tsx, toast.tsx, hooks.ts, useDebounced.ts, format.ts
  components/          Layout, Icon, CasePresentation, ui (Modal, EmptyState, …)
  pages/               Login, Dashboard, Materials, MaterialDetail, Discover, Cases,
                       CaseDetail, CaseEditor, Train, Simulado, Review, Progress, Settings
  styles.css           design system
```

---

## 4. Fluxo de dados (material → caso)

0. **Origem do conteúdo** — três entradas, todas convergindo para `storeSource()`:
   - upload/colar texto (`POST /api/sources`);
   - importar de acervo (`POST /api/discovery/import`) ou por link (`POST /api/discovery/url`);
   - material já existente na biblioteca (`provider: "local"`, reaproveita a fonte sem duplicar).
1. **Upload** (`POST /api/sources`, multipart ou JSON com `text`).
2. **Extração**: `extractDocument` escolhe o parser pelo tipo; devolve texto normalizado, nº de páginas e avisos.
3. **Análise** (`analyzeSource`):
   - divide linhas, detecta títulos (markdown, maiúsculas, numeração, palavras-chave de seção);
   - classifica cada seção (definição, quadro clínico, diagnóstico, tratamento…);
   - extrai frases-fato (7+ palavras, 45–420 caracteres);
   - parseia questões (numeradas) e alternativas (`a)`…), incluindo gabarito inline ou em seção “Gabarito”;
   - detecta temas com **peso** (título ×4, títulos de seção ×3, corpo ×1) e aplica corte relativo (≥ 35% do tema dominante, mínimo 3 ocorrências) para evitar falsos positivos;
   - infere tipo do material (prova / capítulo / resumo) e área.
4. **Prévia** (`POST /api/generate/preview/:id`) roda o modo estruturado em memória e devolve análise + rascunhos.
5. **Geração** (`POST /api/generate/source/:id`) escolhe IA ou estruturado, persiste com **slug determinístico** (`u{userId}-s{sourceId}-{key}`) para upsert, atualiza status do material.
6. **Treino** (`POST /api/attempts` → `.../answer` → `.../finish`), com snapshot por resposta.
7. **Revisão**: ao finalizar, erros viram cards (`upsertCard`) se a preferência estiver ativa.

---

## 5. Modelo de dados

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `users` | id, name, email (único), password_hash (scrypt), role | Uma conta por e-mail. |
| `sessions` | token, user_id, expires_at | Expira em 30 dias; cookie httpOnly. |
| `settings` | user_id, data (JSON) | Inclui IA (chave cifrada), meta diária, data da prova. |
| `sources` | title, kind, discipline, filename/mime, **text**, pages, chars, status, analysis (JSON) | Texto completo guardado para regerar casos. |
| `cases` | user_id, source_id, **slug único**, title, area, topic, difficulty, status, origin, format, minutes, **data (JSON do caso)** | `data` é o snapshot do conteúdo (apresentação + perguntas). |
| `attempts` | case_id, case_title, area, topic, mode, batch_id, status, score, total, started/finished, duration | Uma tentativa por caso; `batch_id` agrupa simulado. |
| `answers` | attempt_id, question_id, option_id, correct, time_ms, **data (JSON do resultado)** | Snapshot do enunciado, correta, justificativa e trecho-fonte. |
| `cards` | case_id, question_id, front, back, ease, interval_days, reps, lapses, due_at | SM-2. |
| `meta` | key, value | Controle de seed e migrações. |

Índices: casos por usuário/status, attempts por usuário/data, answers por usuário/data, cards por usuário/vencimento, sources por usuário.

**Migrações**: `ensureColumn()` adiciona colunas ausentes em bancos antigos (ex.: `answers.data`). Para mudanças estruturais maiores, criar tabela nova + copiar dados.

---

## 6. Descoberta em acervos externos

O app não depende só do que o aluno tem no computador: dá para buscar material aberto, importar e gerar casos sem sair da plataforma.

### Contrato

```ts
interface SourceProvider {
  id: string;
  label: string;
  search(query: string, opts: { limit: number; userId?: number; openAccessOnly?: boolean }): Promise<DiscoveryResult[]>;
  fetchText(result: DiscoveryResult, mode: 'abstract' | 'fulltext'):
    Promise<{ title: string; text: string; originUrl: string | null;
              license: string | null; quality: 'resumo' | 'texto_completo'; notes: string[] }>;
}
```

| Acervo | Busca | Texto | Licença |
| --- | --- | --- | --- |
| **Europe PMC** | artigos, revisões, diretrizes | JATS completo quando OA + PMCID; senão resumo | CC BY e variantes, informada pelo acervo |
| **NCBI Bookshelf** | capítulos de livros-texto | XML do capítulo (`efetch`) | domínio público / CC, conforme o livro |
| **OpenAlex** | metadados + resumo reconstruído | PDF aberto quando `best_oa_location` existe | informada por `license` |
| **PubMed** | MEDLINE via `esearch` + `efetch` | resumo apenas | resumo público |
| **Minha biblioteca** | busca textual nos próprios materiais (sem acento, sem caixa) | texto já salvo | material do usuário |
| **Link direto** | URL informada pelo usuário | HTML/PDF convertido em texto | o usuário declara a origem |

Só fontes **abertas** são baixadas: nada de contornar paywall. Quando só o resumo está acessível, o resultado vem marcado como `resumo` e a importação avisa.

### Busca pública (sem login)

`/descobrir` é a única rota de interface aberta a visitantes. `GET /api/discovery/providers` e `GET /api/discovery/search` respondem sem sessão; `POST /api/discovery/import` e `/url` continuam exigindo login, porque gravam material na conta.

- Para visitante, o catálogo omite o acervo `local` (biblioteca pessoal) e `searchRepositories()` descarta `local` mesmo se pedido no parâmetro `providers`. `aiReady` volta `false`.
- Abuso é contido por dois limites em memória: **30 buscas anônimas por IP a cada 5 min** e **150 no total no mesmo intervalo** (protege as APIs públicas de terceiros). Resposta: `429` com mensagem em português.
- O app usa `trust proxy` (1 salto) para limitar por visitante atrás do proxy do preview/PaaS. Em rede local sem proxy, `TRUST_PROXY=0` desliga.
- O índice de resultados usados pelo import tem teto de 400 entradas, já que buscas anônimas também o alimentam.

### Fluxo

1. `GET /api/discovery/search?q=…` — consulta os acervos em paralelo; falha de um acervo não derruba a busca (`statuses[]` diz o que falhou e por quê). Resultados ficam em cache de 10 min por combinação (query + acervos + filtros).
2. `POST /api/discovery/import` — recebe `{provider, id}` (ou o `result` completo), busca o texto, chama `storeSource()` com referência/licença/URL em `originLabel`, `originUrl`, `license` e `notes`, roda `analyzeSource()` e, se `generate`, dispara `generateForSource()`.
3. `POST /api/discovery/url` — baixa a URL (com guarda anti-SSRF), extrai o texto e segue o mesmo caminho.

O índice de resultados fica em memória por 30 min para que o `import` não dependa de reenviar metadados do cliente, e o `result` enviado pelo cliente é sempre sanitizado.

### Segurança da importação por link

`assertPublicUrl()` resolve o host e bloqueia: esquemas diferentes de http/https, `localhost`, faixas privadas (10/8, 172.16/12, 192.168/16), loopback (127/8, ::1), link-local (169.254/16), CGNAT (100.64/10) e sufixos `.local` / `.internal`. O corpo é limitado a 12 MB, com timeout e `User-Agent` identificando o app. Isso evita SSRF contra a rede interna onde o servidor roda.

### Geração a partir do que foi importado

`generateForSource(userId, source, { mode, maxCases, publish })`:
- `auto` usa IA quando há chave configurada e cai para o estruturado se a chamada falhar (com aviso em `warnings`);
- `persistCases()` grava com slug `u{userId}-s{sourceId}-{key}` — **regerar atualiza** os casos existentes em vez de duplicar.

### Material em inglês

`detectLanguage()` roda na análise e marca `analysis.language` (`pt`, `en`, `es`, `outro`). O léxico tem entradas em português e inglês (temas, áreas, tipos de seção, banco de termos e unidades numéricas), então artigos e capítulos em inglês geram casos normalmente. A interface e a IA continuam respondendo em português.

### Testes

Existem dois suites, com propósitos diferentes:

| Comando | Rede | O que valida |
| --- | --- | --- |
| `npm run test:discovery` | **Não** (fixtures) | 39 verificações: parsers, guarda anti-SSRF, os quatro acervos com respostas simuladas, cache, importação → análise → geração, busca pública sem biblioteca pessoal. Determinístico, roda em CI offline. |
| `npm run test:discovery:live` | **Sim** | Consulta as APIs reais: conectividade por host, busca em cada acervo, texto completo/resumo, busca agregada, importação por link e o fluxo material → análise → casos. Aceita `--query=`, `--providers=`, `--skip-import` e `--probe` (só conectividade). Encerra com código 1 se não houver internet. |
| `npm run test:discovery:live -- --probe` | Sim | Diagnóstico rápido: mostra status e latência de cada acervo, sem rodar o suite. |

O workflow `.github/workflows/discovery-live.yml` roda o suite ao vivo no GitHub Actions (manual ou semanal, segunda 09:00 UTC) — é a forma de validar a integração real quando o ambiente local/preview não tem egress. Ambientes com filtro de rede derrubam o handshake TLS de qualquer host fora da allowlist; nesse caso só o suite offline funciona.

`npm run test:discovery` roda 39 verificações offline: parser HTML/JATS/XML, guarda anti-SSRF, os quatro acervos externos com respostas simuladas (resumo e texto completo), cache agregado, importação → análise → geração, regeração sem duplicar e tratamento de erro de rede. Não faz requisição real — roda em qualquer máquina, inclusive sem internet.

---

## 7. Pipeline de ingestão

### Extração (`server/ingestion/extract.ts`)

- **PDF**: `pdfjs-dist/legacy` no Node. Reconstrução de linhas por `transform[5]` (coordenada Y) com tolerância de 2,5 pt; detecção de PDF sem camada de texto (poucos caracteres por item).
- **DOCX**: `mammoth.extractRawText`.
- **TXT/MD**: UTF-8; aviso se houver caracteres de substituição.
- `.doc` antigo: rejeitado com mensagem orientando converter para `.docx`/PDF.
- Limites: 25 MB, 600 mil caracteres (truncamento com aviso).

### Análise (`server/ingestion/analyze.ts`)

- `isHeading`: markdown, CAIXA ALTA curta, numeração (`1.`, `1.1`), `CAPÍTULO N`, ou palavra-chave de seção.
- `classifySection`: mapa de palavras-chave → 12 tipos.
- `parseQuestions`: máquina de estados simples. Inicia questão em linha numerada com texto; agrega alternativas `a)`–`e)`; aceita `Gabarito: C` inline ou seção com `1 - C`. Só mantém questões com ≥ 2 alternativas.
- `detectTopics`: léxico de 29 temas em 6 áreas, com contagem ponderada e limiar relativo.
- `toAnalysis`: resumo serializável (sem o texto) para a interface.

**Limitações**: questões em colunas, tabelas complexas, V/F e múltipla resposta não são interpretados; OCR não incluído.

---

## 8. Geração estruturada (sem IA)

### Provas antigas (`generateFromExam`)

- Filtrar questões com gabarito, ≥ 3 alternativas e enunciado > 30 caracteres.
- Agrupar em blocos de até 4 questões.
- Título por tema dominante; se o bloco mistura temas, usa a área (“Prova comentada — Clínica Médica”).
- Alternativas são as originais; `correctOptionId` vem do gabarito.
- Justificativa: comentário da prova quando existir; caso contrário, “Gabarito do material: alternativa X”.

### Capítulos e resumos (`generateStudyBlocks`)

1. Selecionar até 4 temas com maior peso.
2. Para cada tema, coletar fatos por tipo de seção (clínico, diagnóstico, tratamento/prevenção).
3. Para cada pool, tentar construir uma **pergunta cloze** (`buildCloze`):
   - localizar o termo mais longo do banco (`classe_farmaco`, `exame`, `conduta`, `desfecho`, `doenca`) com regex insensível a acentos;
   - **excluir das alternativas** qualquer termo que ainda apareça na frase lacunada (evita contradição);
   - se não houver termo, localizar número com unidade e gerar distratores plausíveis (ex.: 140/90 → 126/77, 161/121…);
   - embaralhar de forma determinística (seed = índice do pool + tema);
   - justificativa = trecho original completo.
4. Exigir ≥ 2 perguntas por bloco; caso contrário, não gerar.

**Por que cloze e não “qual afirmação está correta?”**: testamos variantes por antônimo/negação e o resultado ficou artificial (alternativas quase idênticas, correta reconhecível pelo tamanho). Cloze com banco de termos produz alternativas curtas, plausíveis e de mesma categoria — mais próximo de uma questão real e melhor para recuperação ativa.

---

## 9. Geração por IA

### Provedores e endpoint

- **OpenAI / compatível**: `POST {baseUrl}/chat/completions`, `Authorization: Bearer`, `response_format: json_object`.
- **Anthropic**: `POST /v1/messages`, `x-api-key`, `anthropic-version`; prefill de `{` no assistant para forçar JSON.
- Timeout de 150 s; erros 401/403 viram 401 na API, demais 502.
- `testAIConnection` consulta `GET /models` (ou `/v1/models`) e retorna a lista para o seletor de modelo.

### Prompt e contrato

- System prompt define papel (professor de medicina), regras de fidelidade, formato (4 alternativas, uma correta), justificativa em 2–4 frases, citação literal em `sourceExcerpt`, proibição de markdown e exigência de JSON.
- O schema JSON é incluído no prompt do usuário, junto com o trecho do material.
- Chunking: parágrafos agregados em blocos de ~9.000 caracteres, até 4 blocos por geração; 1–2 casos por bloco, respeitando `maxCases` (1–8).

### Validação (`sanitizeCase`)

- Título, área (precisa estar na lista), tema, dificuldade, minutos (3–45).
- Apresentação: strings, arrays limitados, sinais vitais com flag válida, exames com nome/resultado.
- Perguntas: 1–6; alternativas 3–5 com ids `a..e`; `correctOptionId` validado (por id ou por texto); justificativa obrigatória com fallback.
- Caso sem pergunta válida é descartado com aviso. Deduplicação por título normalizado.
- Formato vira `questao` quando não há vinheta (história/exame/exames vazios).

### Tratamento de falhas

- `mode: auto` → se a IA falhar, cai para estruturado e devolve o motivo nos `warnings`.
- `mode: ia` → erro explícito ao usuário (sem fallback silencioso).
- Se nenhum caso for utilizável, retorna 502 com orientação.

---

## 10. Treino, simulado e revisão

### Tentativas

- `POST /api/attempts` cria tentativa `em_andamento` com `total = nº de perguntas`.
- `POST /:id/answer` valida pergunta, impede resposta duplicada, grava snapshot e atualiza `score`.
- `POST /:id/finish` conclui, calcula `duration_ms` e cria cards para erros (se `srsAutoCreate`).
- `POST /api/attempts/start-batch` sorteia casos (próprios + publicados), cria tentativas com `batch_id` comum e devolve os casos já “jogáveis”.

### SM-2 simplificado

| Nota | Qualidade | Efeito |
| --- | --- | --- |
| errei | 1 | reps = 0, lapse++, intervalo 1 dia, ease −0,2 |
| difícil | 3 | intervalo ×1,2, ease −0,15 |
| bom | 4 | intervalo × ease |
| fácil | 5 | intervalo × ease × 1,3, ease +0,15 |

`ease` limitado a 1,3–3,2; intervalo máximo 180 dias; primeira revisão 1 dia, segunda 3–4 dias.

### Integridade do gabarito

- A rota `GET /api/cases/:id/play` devolve o caso **sem** `correctOptionId` e sem justificativas.
- A rota de tentativa retorna o gabarito apenas após o registro da resposta.
- A lista/detalhe completo (com gabarito) é para autor/estudo, não para o fluxo de treino.

---

## 11. API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health` | Status. |
| POST | `/api/auth/register` / `login` / `demo` / `logout` | Sessão. |
| GET/PATCH | `/api/auth/me` | Perfil. |
| GET/POST | `/api/sources` | Listar / enviar material (multipart ou JSON). |
| GET/PATCH/DELETE | `/api/sources/:id` | Detalhe / renomear / excluir. |
| POST | `/api/sources/:id/reanalyze` | Refazer análise. |
| GET | `/api/cases` | Lista com filtros `area`, `difficulty`, `q`, `mine`, `status`, `sourceId`. |
| GET | `/api/cases/:id` / `:id/play` | Detalhe completo / versão para treino. |
| POST | `/api/cases` / `import` | Criar / importar. |
| PUT | `/api/cases/:id` | Atualizar. |
| POST | `/api/cases/:id/publish` / `duplicate` | Publicar / duplicar. |
| GET | `/api/cases/:id/export` | JSON do caso. |
| POST | `/api/generate/preview/:id` | Prévia estruturada sem salvar. |
| POST | `/api/generate/source/:id` | Gerar casos (`mode`, `maxCases`, `publish`). |
| POST | `/api/generate/topic` | Gerar por tema (exige IA). |
| GET | `/api/discovery/providers` | Acervos disponíveis, se a IA está pronta e se a sessão é de visitante. **Público.** |
| GET | `/api/discovery/search` | Busca agregada (`q`, `providers`, `limit`, `oa`). **Público** (limitado por IP). |
| POST | `/api/discovery/import` | Importa um resultado (`provider`, `id`, `mode`, `generate`, `aiMode`, `publish`, `maxCases`). **Requer login.** |
| POST | `/api/discovery/url` | Importa por link (`url`, `title`, …). **Requer login.** |
| POST | `/api/attempts` / `start-batch` | Iniciar treino / simulado. |
| GET | `/api/attempts` / `:id` | Histórico / detalhe. |
| POST | `/api/attempts/:id/answer` / `finish` | Responder / finalizar. |
| GET | `/api/srs` / `due` | Cards / vencidos. |
| POST | `/api/srs/:id/review` | Nota SM-2. |
| POST | `/api/srs/from-case/:id` | Criar cards das perguntas do caso. |
| GET | `/api/stats` / `stats/export.csv` | Painel / exportação. |
| GET/PUT | `/api/settings` | Preferências. |
| POST | `/api/settings/ai/test` / `ai/detect-model` | Testar provedor / listar modelos. |

Erros retornam `{ "error": "mensagem em português" }` com status apropriado (400, 401, 404, 409, 422, 429, 502).

---

## 12. Segurança e privacidade

- **Senhas**: `scrypt` com salt aleatório de 16 bytes; comparação com `timingSafeEqual`.
- **Sessões**: token de 32 bytes em cookie `httpOnly`, `SameSite=Lax`, expiração de 30 dias; sessão apagada no logout. Em HTTPS o cookie recebe `Secure` (automático atrás de proxy confiável, ou forçado com `COOKIE_SECURE=always`).
- **Força bruta**: bloqueio temporário por e-mail após 8 falhas (5 min) — em memória, suficiente para instância única.
- **Chave de IA**: cifrada com AES-256-GCM; chave derivada de `APP_SECRET`; nunca devolvida pela API (`hasKey` booleano).
- **Autorização**: todo recurso verificado por `user_id`; casos publicados legíveis por outros usuários; edição restrita ao autor.
- **Limites**: JSON 3 MB; upload 25 MB; texto 600 mil caracteres; resposta externa 12 MB; tentativas de resposta com tempo limitado.
- **SSRF**: importação por link só aceita http/https públicos — loopback, faixas privadas, link-local, CGNAT e sufixos internos são bloqueados após resolução DNS (ver §6).
- **CSRF**: cookie `SameSite=Lax` + API consumida por mesma origem (proxy em dev, mesmo host em produção).
- **XSS**: React escapa conteúdo; não há `dangerouslySetInnerHTML`.
- **Privacidade**: sem telemetria. Sem IA e sem descoberta, nenhum dado sai da máquina. Com IA, apenas o texto do material é enviado ao provedor escolhido. Na descoberta, só o **termo de busca** vai para os acervos públicos; nada do seu material é enviado a eles.

> Para produção multiusuário: HTTPS obrigatório, rate limit por IP, política de retenção, backup criptografado e revisão de termos de uso/direitos autorais.

---

## 13. Operação

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API com `tsx watch` + Vite (proxy). |
| `npm run build` | Build da SPA em `web/dist`. |
| `npm start` | API + SPA compilada. |
| `npm run seed` | Garante conta demo e conteúdo. |
| `npm run reset` | Remove `data/` (pede confirmação) para recriar do zero. |
| `npm run typecheck` | TypeScript em servidor, cliente e scripts. |
| `npm run test:discovery` | Testes dos acervos, do parser externo e da guarda anti-SSRF (offline). |
| `npm run db:backup` | Cópia íntegra do SQLite (`VACUUM INTO`) com rotação; funciona com o servidor rodando. |
| `npm run test:discovery:live` | Mesmo caminho, mas contra as APIs reais (precisa de internet). `--probe` só mede conectividade. |
| `npm run typecheck` | Checagem TypeScript. |

### Backup

```bash
cp data/studyflux.db data/backup-$(date +%F).db
```

Com WAL ativo, prefira parar o servidor ou usar a API de backup do SQLite antes de copiar em produção.

### Implantação

- Servidor único com Node 22.
- `npm ci && npm run build && npm start` atrás de um proxy HTTPS.
- Persistir `data/` em volume.
- Definir `APP_SECRET` para não depender do arquivo gerado.

### Checklist de verificação manual

1. Entrar como demo → Início mostra estatísticas e gráfico.
2. Materiais → enviar o PDF de teste ou colar texto → análise e prévia aparecem.
3. Gerar no modo estruturado → casos criados; abrir um caso.
4. Treinar → responder certo e errado → feedback com trecho-fonte.
5. Finalizar → resumo; erros aparecem em Revisão.
6. Revisar um card → intervalo e vencimento mudam.
7. Simulado com 3 casos → responder e ver resultado por caso.
8. Configurações → salvar meta e data da prova → refletido no Início.
9. Exportar CSV → abre no Excel/LibreOffice com acentos corretos (BOM UTF-8).

---

## 14. Deploy

O app é **um processo de longa duração com SQLite em disco**. Isso define o alvo: container/VM com volume persistente e egress livre — não funções serverless.

| Peça | Arquivo | Observação |
| --- | --- | --- |
| Imagem de produção | `Dockerfile` | Multi-stage (`npm ci` + `vite build` → runtime com `npm ci --omit=dev`), usuário `node`, `VOLUME /data`, `HEALTHCHECK` em `/api/health`. |
| Execução local/VPS | `docker-compose.yml` | Volume `studyflux-data` em `/data`, variáveis com padrões seguros. |
| Render | `render.yaml` | Blueprint com disco de 1 GB em `/data`, `APP_SECRET` gerado, `SEED_DEMO=0`. |
| Fly.io | `fly.toml` | Volume `studyflux_data`, `force_https`, região `gru`, **uma máquina só**. |
| Backup | `scripts/backup.mjs` | `VACUUM INTO` com o servidor rodando + rotação (`BACKUP_KEEP`). |

**Decisões de produção embutidas no código**

- `tsx` é dependência de **runtime** (não dev): `npm start` executa TypeScript direto, sem etapa de compilação do servidor — o que também preserva imports relativos de `shared/types`.
- `COOKIE_SECURE=auto` marca o cookie como `Secure` quando `req.secure` ou `X-Forwarded-Proto: https`; precisa de `TRUST_PROXY` correto para funcionar atrás de proxy.
- `SEED_DEMO=0` desliga o seed da conta demo **e** o `POST /api/auth/demo` (403), e o `GET /api/health` passa a devolver `demo: false` para a tela de login esconder o botão.
- `APP_SECRET` por variável de ambiente evita depender de `DATA_DIR/app.secret` (que continua sendo o padrão local).
- **Instância única por design**: SQLite single-writer, caches de descoberta e limite de busca anônima vivem em memória. Escalar horizontalmente exige Postgres + cache compartilhado.

Passo a passo operacional: [DEPLOY.md](DEPLOY.md).

---

## 15. Próximos passos técnicos

1. **OCR** (Tesseract local via `tesseract.js` ou serviço) com fila assíncrona e status no material.
2. **Processamento em background** para PDFs grandes (hoje síncrono) — tabela `jobs` + worker.
3. **Moderação/curadoria** de casos publicados (revisão, denúncia, selo “verificado”).
4. **Postgres + storage** para escala multiusuário; SQLite permanece como modo local.
5. **Testes automatizados**: unitários do parser e do cloze (casos de borda), integração das rotas com banco em memória, e2e com Playwright.
6. **Observabilidade**: log estruturado, métricas de geração e falhas de IA.
7. **Perfil de domínio** (ver [PRODUTO.md](PRODUTO.md#10-expansão-para-outras-profissões)) para abrir a plataforma a outras profissões.
8. **i18n** e acessibilidade (foco visível, ARIA em diálogos, contraste AA).
9. **Mais acervos abertos**: SciELO, LILACS, BVS, DOAJ e diretrizes brasileiras (CONITEC, SBC), além de filtro por idioma na busca.
10. **Cache persistente de busca** (SQLite) e limite de requisições por usuário para não abusar das APIs públicas dos acervos.

---

## 16. Arquivos-chave para começar a mexer

| Quero… | Vá para |
| --- | --- |
| Mudar o visual | `web/src/styles.css` |
| Adicionar uma área/tema médico | `server/ingestion/lexicon.ts` |
| Melhorar a extração de PDF | `server/ingestion/extract.ts` |
| Ajustar a leitura de provas/gabaritos | `server/ingestion/analyze.ts` |
| Mudar o banco de termos das alternativas | `server/generation/cloze.ts` |
| Alterar o prompt da IA | `server/generation/llm.ts` |
| Adicionar um acervo externo | `server/discovery/providers/*` + registro em `server/discovery/index.ts` |
| Mudar o limite/cache das buscas | `server/discovery/index.ts` |
| Ajustar a guarda anti-SSRF | `server/discovery/http.ts` |
| Adicionar uma rota | `server/routes/*` + registrar em `server/index.ts` |
| Mudar o algoritmo de revisão | `server/srs.ts` |
| Ajustar conteúdo demo | `server/seed/*` |
| Publicar / hospedar | `Dockerfile`, `docker-compose.yml`, `render.yaml`, `fly.toml`, `docs/DEPLOY.md` |
| Fazer backup do banco | `scripts/backup.mjs` |
