# Study Flux

> **Do material de estudo ao caso clínico.** Plataforma de treino para estudantes de medicina em período de provas: envie uma prova antiga, um capítulo de livro ou um resumo — ou busque um artigo aberto em acervos científicos — e transforme o conteúdo em casos clínicos, simulados e revisão espaçada.

O projeto nasce focado em medicina, mas foi estruturado para crescer para outras profissões (ver [expansão](docs/PRODUTO.md#10-expansão-para-outras-profissões)).

---

## O problema

No período de provas, o estudante de medicina precisa conciliar três coisas que raramente conversam:

1. **Volume**: pilhas de capítulos, resumos e provas antigas.
2. **Tempo**: semanas até a prova, com dezenas de temas.
3. **Forma de estudar**: reler e grifar dá sensação de progresso, mas não treina recuperação ativa — o que a prova cobra.

As plataformas de questões existentes resolvem parte disso, mas não aproveitam **o material que o aluno já tem** (o capítulo do professor, a prova da faculdade, o resumo do grupo). E ferramentas de IA genéricas geram perguntas soltas, sem progressão clínica, sem rastrear o que foi errado e sem garantir fidelidade ao conteúdo.

**Study Flux fecha esse ciclo**: material → casos → treino → revisão → lacunas identificadas.

---

## O fluxo

```
   MATERIAIS                (1) TRAZER CONTEÚDO                       (2) VIRAR CASO
   ┌──────────────┐   ┌───────────────────────────────┐   ┌──────────────────────┐
   │ PDF / DOCX   │   │ enviar arquivo ou colar texto │   │ análise: temas,      │
   │ prova antiga │──▶│ importar por link             │──▶│ seções, questões,    │
   │ capítulo     │   │ buscar em acervos abertos     │   │ gabarito             │
   └──────────────┘   │ (Europe PMC, Bookshelf,       │   └──────────┬───────────┘
                      │  OpenAlex, PubMed)            │              │
                      │ ou gerar por tema (com IA)    │              ▼
                      └───────────────────────────────┘   ┌──────────────────────┐
                                                          │ casos clínicos ou    │
                                                          │ blocos de fixação    │
                                                          └──────────┬───────────┘
                                                                     ▼
                                              ┌──────────────┐  ┌──────────────┐
                                              │   TREINO     │─▶│  PROGRESSO + │
                                              │ feedback,    │  │ revisão      │
                                              │ simulado     │  │ espaçada     │
                                              └──────────────┘  └──────────────┘
```

---

## O que já funciona

| Área | Recursos |
| --- | --- |
| **Materiais** | Upload de PDF (com camada de texto), DOCX, TXT e MD; colar texto; análise automática de seções, temas, condições e questões com gabarito; prévia do que será gerado. |
| **Descobrir conteúdo** | **Busca aberta, sem login** em acervos científicos (Europe PMC, NCBI Bookshelf, OpenAlex, PubMed) e na própria biblioteca, com filtro de acesso aberto, leitura de resumo ou texto completo, importação por **link** e geração de casos em seguida. Cada material guarda referência, licença e URL de origem. Importar (de um acervo ou por link) e **gerar por tema** (IA) pedem conta, porque gravam na sua biblioteca. |
| **Geração de casos** | **Modo estruturado (sem IA)**: extrai questões de provas antigas com gabarito e monta perguntas de completar (cloze) fiéis ao texto. **Modo IA (opcional)**: casos clínicos completos com paciente, exame físico, exames e perguntas em progressão. **Automático**: usa IA quando disponível. |
| **Biblioteca** | Filtros por área, dificuldade, status e busca; publicar/despublicar; duplicar (inclusive casos da comunidade); exportar/importar JSON; editor manual completo. |
| **Treino** | Caso com prontuário sempre visível, feedback imediato com justificativa e trecho da fonte, atalhos de teclado, resumo final com revisão das respostas. |
| **Simulado** | Sequência de casos por área, sem correção durante o percurso, com pontuação por caso e tempo total. |
| **Revisão espaçada** | Cards criados automaticamente a partir dos erros, algoritmo SM-2 (mesma família do Anki), agenda de vencimento e revisão por autopercepção. |
| **Progresso** | Acerto por área e por tema, pontos fortes e frágeis, constância de 14 dias, histórico detalhado, exportação CSV. |
| **Conta e privacidade** | Sessões com cookie httpOnly, senha com scrypt, chave de IA criptografada (AES-256-GCM), banco local SQLite. |
| **Demonstração** | Conta demo com 9 casos autorais completos, 2 materiais (resumo e prova com gabarito), casos gerados e histórico de estudo. |

---

## Como rodar

Pré-requisitos: **Node.js 22+** (usa `node:sqlite` nativo) e npm.

```bash
npm install
npm run dev
```

- Interface: <http://localhost:5173>
- API: <http://localhost:8787> (a interface faz proxy de `/api`)
- Conta demo: **demo@studyflux.app** / **estudar123** — ou clique em *Entrar como demo* na tela de login.

Outros comandos:

```bash
npm run seed       # cria/atualiza a conta demo e o conteúdo de demonstração
npm run reset      # apaga o banco local (data/) para começar do zero
npm run db:backup   # cópia consistente do SQLite (VACUUM INTO) em data/backups
npm run typecheck  # TypeScript do servidor, scripts e tipos compartilhados
npm run build      # build da interface Angular em web/dist
npm run test:web   # smoke test da interface (jsdom) — precisa do app no ar
npm start          # serve API + interface compilada em http://localhost:8787
npm run test:discovery       # testes dos acervos com fixtures (offline, sem rede)
npm run test:discovery:live  # testes AO VIVO: consultam Europe PMC, Bookshelf, OpenAlex e PubMed de verdade
```

### Deploy para os estudantes

O app é um processo Node com SQLite em disco: precisa de **container/VM com volume persistente e saída para a internet** (Netlify/Vercel não servem para o backend). Não é preciso migrar nada — Railway, Render e Fly.io rodam este repositório como está:

| Plataforma | Deploy | Custo mínimo (out/2026) |
| --- | --- | --- |
| Railway | conecta o repo, adiciona volume | ~US$ 5/mês |
| Render | blueprint `render.yaml` | ~US$ 7/mês + disco |
| Fly.io | `fly deploy` | ~US$ 2,35/mês |
| VPS | `docker compose up -d --build` | ~US$ 4–6/mês |

O repositório já tem `Dockerfile`, `docker-compose.yml`, `render.yaml`, `railway.json` e `fly.toml`.

```bash
docker compose up -d --build   # http://localhost:8787, dados no volume studyflux-data
```

Passo a passo completo (VPS com HTTPS, Render, Fly.io e túnel do Cloudflare para testar hoje): **[docs/DEPLOY.md](docs/DEPLOY.md)**.

Para uso público, rode com `SEED_DEMO=0` (sem conta demo compartilhada) e `APP_SECRET` fixo.

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `8787` | Porta da API/servidor de produção. |
| `DATA_DIR` | `./data` | Onde ficam o banco SQLite e o segredo de sessão. |
| `APP_SECRET` | gerado em `data/app.secret` | Segredo para assinar sessões e criptografar a chave de IA. |
| `OPENALEX_MAILTO` | — | E-mail de contato enviado à API do OpenAlex (boa prática de uso). |
| `TRUST_PROXY` | `1` | Confia em 1 salto de proxy para limitar a busca anônima por visitante. Use `0` em rede local sem proxy. |
| `SEED_DEMO` | `1` | `0` desativa a conta demo e o botão “Entrar como demo” (recomendado em deploy público). |
| `COOKIE_SECURE` | `auto` | Cookie de sessão com `Secure` quando a conexão é HTTPS. |

> O banco é criado e semeado automaticamente no primeiro start. `data/` e `web/dist/` estão no `.gitignore`.

---

## IA é opcional

Sem nenhuma chave de API, a plataforma já é útil: o **modo estruturado** gera perguntas a partir do próprio texto do material — questões de provas antigas com gabarito são reaproveitadas na íntegra, e capítulos geram perguntas de completar com alternativas do mesmo domínio (fármacos, exames, condutas, valores numéricos). Toda resposta cita o trecho original.

Com IA, o material vira **caso clínico narrativo** (paciente, anamnese, exame físico, exames, perguntas em progressão, justificativas). A configuração fica em **Configurações → Geração por IA**:

- Provedores: OpenAI, Anthropic ou qualquer API compatível com OpenAI (Groq, OpenRouter, Together, Ollama local).
- A chave é criptografada no banco e nunca retorna para a interface.
- Há botão de **testar conexão** e de **listar modelos** do provedor.

⚠️ Ao gerar com IA, apenas o texto do material é enviado ao provedor escolhido. Sem IA, nada sai da máquina.

---

## Arquitetura em uma tela

| Camada | Tecnologia | Por quê |
| --- | --- | --- |
| Interface | Angular 22 (standalone + signals) + CSS próprio | Framework com suporte de longo prazo (até 2028), router/HTTP/forms na caixa e convenções que sustentam mais gente no time. |
| API | Express 5 + TypeScript (tsx) | Simples de rodar, tipada ponta a ponta com os tipos compartilhados. |
| Banco | SQLite nativo do Node (`node:sqlite`) | Zero configuração, arquivo único, fácil de fazer backup e de migrar para Postgres depois. |
| Extração | `pdfjs-dist` (PDF), `mammoth` (DOCX) | Boa extração local, sem serviço externo. |
| Geração | Motor próprio (regras + léxico) e cliente LLM opcional | Funciona offline; IA é um acelerador, não uma dependência. |
| Revisão | SM-2 | Comprovado, previsível e explicável ao aluno. |

```
server/
  ingestion/    extração de PDF/DOCX, análise de seções, temas e gabaritos, léxico médico
  generation/   gerador estruturado (cloze + provas), cliente de IA e sanitização
  routes/       auth, sources, cases, generate, attempts, srs, stats, settings
  seed/         conta demo, casos autorais e materiais de exemplo
shared/types.ts tipos usados pelo servidor e pela interface
web-ng/src/app/ componentes standalone: core (API/auth/toast), shared (ui, layout), pages
web-ng/src/styles.css  design system (o mesmo CSS de antes)
web/dist/       build da interface (gerado; servido pelo Express)
docs/           análise de produto e arquitetura
```

Detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## Limitações conhecidas (honestas)

- A busca em acervos **precisa de saída para a internet no servidor**. Neste ambiente de preview a rede é bloqueada para hosts externos; para validar contra as APIs reais, rode `npm run test:discovery:live` na sua máquina ou dispare o workflow *Descoberta (ao vivo)* no GitHub Actions.
- A **busca** nos acervos é aberta (sem conta), mas **importar, gerar casos, treinar e revisar exigem login**. A busca anônima é limitada (30 por visitante a cada 5 minutos) para não abusar das APIs públicas.
- A descoberta usa **apenas fontes abertas**. Artigos pagos não são baixados: para eles, o app importa só o resumo, quando disponível, e sempre mostra o link da editora. O preview em nuvem pode não ter saída para a internet — nesse caso a busca avisa e continua funcionando com a sua biblioteca.
- **PDF escaneado sem camada de texto** não é lido: não há OCR nesta versão. A plataforma avisa e sugere colar o texto.
- O modo estruturado funciona melhor com material **com subtítulos** (Definição, Quadro clínico, Diagnóstico, Tratamento) ou com **questões + gabarito**. Texto corrido gera menos perguntas.
- A geração por IA depende da qualidade do provedor escolhido e **deve ser revisada** antes de publicar — o app mostra as perguntas e o trecho-fonte para conferência.
- Comunidade é aberta a casos publicados entre usuários; não há moderação nem curadoria editorial nesta versão.
- Um único processo/servidor: sem fila assíncrona para PDFs muito grandes (limite de 25 MB e extração síncrona).
- Não substitui material oficial nem orientação clínica: é ferramenta de estudo.

---

## Documentação

- **[Análise de produto](docs/PRODUTO.md)** — problema, usuários, jornada, decisões, métricas, roadmap e expansão para outras profissões.
- **[Arquitetura](docs/ARQUITETURA.md)** — modelo de dados, pipeline de geração, API, segurança e operação.
- **[Guia rápido de uso](docs/COMO-USAR.md)** — passo a passo do primeiro material ao primeiro simulado.
- **[Deploy](docs/DEPLOY.md)** — colocar no ar para os estudantes: Docker, Render, Fly.io, VPS com HTTPS e backups.

---

Feito para estudar com casos — e não apenas reler o capítulo.
