# Deploy — colocar o Study Flux no ar para os estudantes

Este guia responde a uma pergunta só: **como dar um link para os alunos abrirem e usarem** — com busca em acervos científicos funcionando de verdade (o servidor precisa de saída para a internet) e com os dados sobrevivendo a reinícios.

---

## 1. Resumo da decisão

O Study Flux é **um processo Node que serve a interface e a API na mesma porta**, com **SQLite em disco**. Isso pede um runtime com:

| Necessidade | Por quê |
| --- | --- |
| Processo de longa duração | Express 5 + sessões em memória + caches de busca |
| **Disco persistente** | `studyflux.db`, sessões e `app.secret` em `DATA_DIR` |
| **Saída para a internet** | Europe PMC, NCBI Bookshelf, OpenAlex, PubMed e importação por link |
| Upload de até 25 MB | PDFs de provas e capítulos |
| Tempo de resposta generoso | Extração de PDF + análise + geração de casos (e IA, quando configurada) |

**Conclusão:** container (Docker) ou máquina virtual com volume. **Netlify/Vercel não servem para o backend** — são CDN + funções efêmeras, com disco somente leitura, payload de 6 MB e timeout curto.

A **interface**, porém, é estática e pode ficar na Netlify — desde que a API continue em um host com disco. Isso separa o deploy em dois lugares e adiciona um proxy no caminho de cada chamada; só vale a pena se você quiser o domínio/`deploy preview`/rollback da Netlify. Como fazer, com os limites na mesa: **seção 9**.

Se o objetivo é um link público para os alunos **sem reescrever nada**, use uma plataforma que roda o contêiner com disco (Railway, Render, Fly.io) — o código já está preparado. Detalhes de custo na seção 2.

O repositório já vem com os arquivos prontos:

```
Dockerfile             imagem de produção (multi-stage, non-root, healthcheck)
docker-compose.yml     execução local/VPS com volume persistente
render.yaml            blueprint do Render (com disco)
railway.json           detecção do Dockerfile + healthcheck no Railway
fly.toml               configuração do Fly.io (com volume)
netlify.toml           interface na Netlify + proxy da API (seção 9)
scripts/backup.mjs     backup consistente do SQLite (npm run db:backup)
```

---

## 2. Opções, do mais simples ao mais controlável

O Study Flux **não precisa de migração** para ir para a nuvem: basta uma plataforma que rode um contêiner (ou processo Node) com **volume persistente** e **saída para a internet**. Todas as opções abaixo aceitam o `Dockerfile` deste repositório e fazem deploy por `git push` — o fluxo é o mesmo do Netlify, só que com disco.

Preços de referência (outubro/2026, sem impostos):

| Plataforma | Como é o deploy | Menor configuração que serve | Custo mensal aproximado |
| --- | --- | --- | --- |
| **Railway** | conecta o repositório, detecta o `Dockerfile` | 1 serviço + volume de 1 GB | **US$ 5** (Hobby, já inclui US$ 5 de uso) |
| **Render** | blueprint `render.yaml`, auto-deploy no push | web service 0,5 CPU/512 MB + disco 1 GB | **US$ 7,25** (US$ 7 + US$ 0,25/GB) |
| **Fly.io** | `fly deploy` (CLI) | 1 máquina shared-cpu 256 MB + volume 1 GB | **~US$ 2,35** (US$ 2,19 + US$ 0,15/GB) |
| **Zeabur** | conecta o repositório, adiciona volume no painel | 1 contêiner + volume | **~US$ 5** (plano Dev com US$ 5 de crédito) |
| **VPS + Docker Compose** | `git clone` + `docker compose up -d --build` | 1 vCPU / 1 GB / 20 GB | **US$ 4–6** (Hetzner, Contabo, Magalu Cloud) + domínio |
| **Cloudflare Tunnel + seu PC** | roda local e expõe por túnel | seu computador ligado | **grátis** (endereço temporário) |
| ~~Netlify, Vercel, Cloudflare Pages~~ | estático + funções | — | não servem: sem disco, 6 MB de payload e timeout curto |
| ~~Koyeb~~ | contêiner | — | desde fev/2026 não aceita novos usuários no plano gratuito (Pro US$ 29) |

**Plano gratuito: o que dá e o que não dá**

- **Render free** e **Railway free** (US$ 1 de crédito) não sustentam este app: o Render free **não aceita disco** e perde o sistema de arquivos a cada deploy, reinício ou hibernação — ou seja, o SQLite sumiria. O Railway free dá cerca de 1/5 do necessário para rodar 24×7.
- **Fly.io** é o mais barato para ficar sempre no ar (~US$ 2,35/mês), mas exige CLI.
- É possível rodar **de graça** combinando um plano free com replicação contínua do SQLite para um bucket (Litestream → Cloudflare R2, 10 GB grátis) e restauração no boot. Funciona, mas troca "um disco" por "um processo a mais para vigiar" — e o serviço free hiberna após 15 min sem tráfego, com ~1 min de cold start para o aluno. Só recomendo se custo for realmente bloqueante.

> Regra prática: **Railway** se você quer o caminho mais parecido com o Netlify (conectar repo, criar volume, pronto). **Render** se prefere blueprint versionado no repositório. **Fly.io** se quer o menor custo com região no Brasil (`gru`). **VPS** se a faculdade exige domínio próprio e controle dos dados.

---

## 3. Variáveis de ambiente

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `8787` | Porta HTTP (o Render/Fly injetam a dele; o app respeita). |
| `DATA_DIR` | `./data` (na imagem: `/data`) | Onde ficam `studyflux.db` e `app.secret`. **Precisa ser o volume.** No Railway, se não for definida, o app usa `RAILWAY_VOLUME_MOUNT_PATH` automaticamente. |
| `APP_SECRET` | gerado em `DATA_DIR/app.secret` | Assina sessões e cifra a chave de IA. Em produção, defina para não depender do arquivo. |
| `SEED_DEMO` | `1` | `0` desativa a conta demo **e** esconde o botão “Entrar como demo”. **Use `0` em deploy público.** |
| `COOKIE_SECURE` | `auto` | `auto` marca o cookie como `Secure` quando a requisição chega por HTTPS. `always` força; `never` só para depuração. |
| `TRUST_PROXY` | `1` | Confia em 1 salto de proxy (Caddy, Render, Fly, Cloudflare) para IP real e HTTPS. Use `0` sem proxy. |
| `OPENALEX_MAILTO` | — | E-mail de contato enviado ao OpenAlex (boa prática de uso da API). |
| `CORS_ORIGIN` | — | Só quando a interface fica em outro domínio (ex.: Netlify): origens liberadas a chamar a API, separadas por vírgula. Vazio = mesma origem, sem CORS. |
| `COOKIE_DOMAIN` | — | Só no cenário de subdomínio (interface em `app.dominio.com`, API em `api.dominio.com`): `.dominio.com` faz o cookie valer para os dois. Vazio = cookie restrito ao host da API. |

Com `SEED_DEMO=0`, cada estudante cria a própria conta em `/login` → *Criar agora*. A busca em acervos continua **aberta sem login** (com limite de 30 buscas por visitante a cada 5 minutos).

---

## 4. Caminho A — Docker Compose (VPS ou máquina da faculdade)

Pré-requisito: Docker + Docker Compose. Numa VPS Ubuntu:

```bash
sudo apt update && sudo apt install -y docker.io git
# Ubuntu 24.04: docker-compose-v2 · Ubuntu 22.04: docker-compose-plugin (repositório oficial da Docker)
sudo apt install -y docker-compose-v2 || sudo apt install -y docker-compose-plugin
git clone https://github.com/guiOmachado/study-flux.git /opt/study-flux
cd /opt/study-flux

# Produção aberta: sem conta demo compartilhada
cp .env.example .env
sed -i 's/^SEED_DEMO=.*/SEED_DEMO=0/' .env
# Opcional, mas recomendado (não muda o segredo em reinícios nem troca de host)
echo "APP_SECRET=$(openssl rand -hex 32)" >> .env
echo "OPENALEX_MAILTO=voce@suafaculdade.br" >> .env

docker compose up -d --build
docker compose logs -f app
```

Acesse `http://IP-DA-VPS:8787`. O volume `studyflux-data` guarda o banco — `docker compose down` não apaga, só `docker compose down -v` apaga.

### HTTPS com domínio próprio (Caddy, certificado automático)

`Caddyfile`:

```
estudo.suafaculdade.com {
  encode gzip
  reverse_proxy app:8787
}
```

`docker-compose.override.yml`:

```yaml
services:
  app:
    ports: []            # não expõe 8787 direto na internet
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on: [app]

volumes:
  caddy-data:
```

```bash
docker compose up -d
```

Aponte o DNS (`A`) do subdomínio para o IP da VPS. O Caddy emite e renova o certificado sozinho; com HTTPS, `COOKIE_SECURE=auto` passa a marcar o cookie como `Secure` automaticamente.

---

## 5. Caminho B — Render (blueprint)

1. **New + → Blueprint**, escolha este repositório. O Render lê `render.yaml`.
2. Ajuste `plan` se necessário: **disco persistente exige instância paga** (`starter` = 0,5 CPU/512 MB, US$ 7/mês). No plano free o serviço **não aceita disco** e o SQLite seria apagado a cada deploy, reinício ou hibernação — não use free para dados de alunos.
3. Preencha `OPENALEX_MAILTO` quando pedir (é `sync: false`).
4. Deploy. O healthcheck usa `/api/health`; a porta vem de `PORT`.

O blueprint já define `SEED_DEMO=0`, `DATA_DIR=/data`, disco de 1 GB montado em `/data` e `APP_SECRET` gerado pelo próprio Render.

> Se um dia o app crescer, confira o tamanho do volume: cada material guarda o texto extraído, então 1 GB atende com folga uma turma, mas acompanhe.

---

## 6. Caminho C — Railway (o mais próximo do Netlify)

1. **New Project → Deploy from GitHub repo** e escolha este repositório. O `railway.json` manda usar o `Dockerfile` e o healthcheck em `/api/health`.
2. No serviço, aba **Variables**: `SEED_DEMO=0` (produção) e `APP_SECRET` (gere com `openssl rand -hex 32`). `PORT` é injetada pela plataforma e o app já respeita.
3. Aba **Volumes → Add Volume**, mount path **`/data`**, 1 GB. Não precisa configurar `DATA_DIR`: o app usa `RAILWAY_VOLUME_MOUNT_PATH` automaticamente quando o volume existe.
4. **Settings → Networking → Generate Domain** para receber a URL pública (ou aponte um domínio seu).
5. Deploy. Acompanhe os logs: aparecem `Dados: /data`, `conta demo: desativada` e a porta efetiva.

```bash
# opcional, pelo CLI
npm i -g @railway/cli
railway login && railway link
railway variables --set SEED_DEMO=0 --set APP_SECRET=$(openssl rand -hex 32)
railway up
```

Pontos de atenção: mantenha **1 réplica** (SQLite + caches em memória), e o volume do plano Hobby vai até 5 GB — suficiente para uma turma, porque cada material guarda apenas o texto extraído.

---

## 7. Caminho D — Fly.io

```bash
# 1) ajuste o nome do app em fly.toml (precisa ser único)
fly launch --no-deploy --copy-config

# 2) volume onde vive o SQLite (uma vez só)
fly volumes create studyflux_data --size 1 --region gru

# 3) segredos
fly secrets set APP_SECRET=$(openssl rand -hex 32)

# 4) publicar
fly deploy
fly open
```

O `fly.toml` já vem com `force_https = true`, `PORT=8080`, `DATA_DIR=/data`, `SEED_DEMO=0` e **uma única máquina** — não escale horizontalmente: SQLite + caches em memória assumem instância única.

---

## 8. Caminho E — Sem servidor: túnel do seu computador

Útil para colocar no ar **hoje**, com os alunos testando, sem contratar nada. O Cloudflare Tunnel cria um endereço público HTTPS para o app rodando na sua máquina (sem abrir porta no roteador).

```bash
# terminal 1 — aplicação
npm install && npm run build
SEED_DEMO=0 DATA_DIR=./data PORT=8787 npm start

# terminal 2 — túnel rápido (endereço temporário)
cloudflared tunnel --url http://localhost:8787
```

O `cloudflared` imprime algo como `https://algo-aleatorio.trycloudflare.com` — esse é o link para os alunos.

Limites honestos: o endereço muda quando você reinicia, e **se o seu computador desligar, o site sai do ar**. Para um endereço fixo no seu domínio:

```bash
cloudflared tunnel login
cloudflared tunnel create study-flux
cloudflared tunnel route dns study-flux estudo.suafaculdade.com
cloudflared tunnel run --url http://localhost:8787 study-flux
```

---

## 9. Interface na Netlify (API em outro host)

Dá para usar a Netlify — **só para a interface**. O backend continua em um host com disco (seções 4 a 7). O `netlify.toml` deste repositório já está pronto.

```
navegador do aluno
   │  https://study-flux.netlify.app/casos      → HTML/JS/CSS estáticos (CDN)
   └─ https://study-flux.netlify.app/api/...    → regra de proxy no netlify.toml
                     │
                     ▼
        https://SEU-BACKEND/api/...            → Node + SQLite, com volume e saída aberta
```

**Por que a API não pode morar na Netlify:** as funções têm disco efêmero (o SQLite sumiria a cada deploy), execução síncrona de 10 s (30 s com liberação) e payload de 6 MB. O Study Flux recebe PDFs de até 25 MB, faz busca em cinco acervos externos e, com IA configurada, espera até 150 s por uma geração. Nada disso cabe — e não é limitação do código.

**Custo (contas criadas depois de 04/09/2025):** o plano gratuito virou **300 créditos por mês, com teto rígido** — ao zerar, o site é pausado até o mês seguinte. As taxas de 2026: 20 créditos por GB de banda (≈ 15 GB), 2 créditos por 10 mil requisições, 15 créditos por deploy de produção, 10 créditos por GB-hora de compute. Uma turma pequena (≈ 5 GB e 3 deploys no mês) consome ~150 créditos. Passando disso: Personal, US$ 9/mês, 1 TB de banda.

### 9.1 Opção A — proxy pela Netlify (mais simples, mesma origem)

O navegador só conversa com o domínio da Netlify; ela repassa `/api/*` para o backend. O cookie `sf_session` continua sendo **de primeira parte**, então login, sessão de 30 dias e uploads funcionam sem nenhuma mudança de código.

1. Publique a API primeiro (seção 5, 6 ou 7) e guarde a URL, por exemplo `https://study-flux.up.railway.app`. Lá, mantenha `SEED_DEMO=0`.
2. **Ajuste o único ponto que precisa ser editado** em `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://study-flux.up.railway.app/api/:splat"   # <- troque aqui
  status = 200
  force = true
```

3. Na Netlify: *Add new site → Import an existing project → GitHub* e escolha este repositório. Build e publish vêm do `netlify.toml` (`npm ci && npm run build`, `web/dist`, Node 22) — não precisa preencher nada na interface, nem variáveis de ambiente.
4. Abra o site e confira `https://SEU-SITE.netlify.app/api/health` → deve devolver o JSON da sua API. Se devolver o HTML do app, a regra de proxy não foi aplicada (veja 9.3).

Dá para testar a topologia inteira **antes** de criar o site, com um simulador que aplica as regras do `netlify.toml` (estático + proxy de `/api/*` + fallback da SPA) na sua máquina:

```bash
npm run build
npm start                      # API na 5173 (terminal 1)
npm run test:netlify -- 5180 http://127.0.0.1:5173   # "Netlify" na 5180 (terminal 2)
SMOKE_BASE=http://127.0.0.1:5180 npm run test:web    # a suíte da interface, pelo proxy
```

**Limite que aparece na prática: 26 segundos por requisição.** A Netlify corta o proxy nesse prazo, e algumas rotas do Study Flux passam disso quando a rede está ruim:

| Operação | Tempo típico | Passa dos 26 s? |
| --- | --- | --- |
| Listar casos, treinar, revisar (SRS), estatísticas | < 1 s | não |
| Login, cadastro, upload de PDF de prova | 1–5 s | não |
| Busca nos acervos (`/api/discovery/search`) | 3–20 s (5 provedores em paralelo, cada um até 30 s) | **às vezes** |
| Geração de casos por IA (`/api/generate/*`) | 15–90 s | **sim, com frequência** |
| Importação de link/PDF com análise + IA | 10–60 s | às vezes |

Quando estoura, o aluno vê um erro de rede (HTTP 504) mesmo com o backend terminando o trabalho. Se o uso principal for a geração por IA, use a opção 9.2.

### 9.2 Opção B — API em subdomínio (sem o corte de 26 s)

Interface em `app.seudominio.com` (Netlify) e API em `api.seudominio.com` (Railway et al.). O navegador chama a API direto, então não há proxy no meio e nenhum limite de tempo.

Isso exige **domínio próprio**: `*.netlify.app` e `*.up.railway.app` são *sites* diferentes para o navegador, e aí o cookie viraria terceira parte — bloqueado por padrão no Safari e no Chrome. Já `app.seudominio.com` e `api.seudominio.com` compartilham o domínio registrável, e o cookie `SameSite=Lax` continua válido.

No backend (Railway/Render/Fly/VPS):

```bash
CORS_ORIGIN=https://app.seudominio.com
COOKIE_DOMAIN=.seudominio.com
COOKIE_SECURE=always
```

No frontend, uma linha em `web-ng/src/index.html` (bloco que já existe no `<body>`):

```html
<script>
  window.__SF_API__ = 'https://api.seudominio.com';
</script>
```

Sem barra no final. Vazio é o padrão e significa “mesma origem” — nada muda para quem serve tudo pelo mesmo Node.

### 9.3 Problemas comuns

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| `/api/health` devolve o HTML do app | regra `/api/*` ausente, depois do `/*`, ou sem `force = true` | a regra da API precisa vir **antes** do fallback da SPA no `netlify.toml` |
| Rotas internas dão 404 ao recarregar | falta o fallback `/* → /index.html` com status 200 | já incluído no arquivo; confira se ele não foi apagado |
| Login “funciona” mas a sessão não persiste | proxy devolvendo `Set-Cookie` com `Domain` do backend, ou build servido por `http://` | use a opção A sem `COOKIE_DOMAIN`; em produção o site é sempre `https` |
| `504` ao gerar casos | corte de 26 s do proxy | opção B (subdomínio), ou gere casos a partir do próprio domínio da API |
| `CORS` bloqueado no console | origem do front fora de `CORS_ORIGIN` (só na opção B) | inclua a origem exata, com `https://` e sem barra final |
| Build falha com “Node version” | a Netlify usou um Node antigo | o `NODE_VERSION = "22"` está no `netlify.toml`; se você criou o site antes dele, rode *Clear cache and deploy site* |
| Site pausado no meio do mês | créditos gratuitos esgotados | *Billing → upgrade* ou reduza deploys de produção |

**Cache:** o `netlify.toml` marca os bundles com hash como imutáveis (1 ano) e o `index.html` como `must-revalidate`, então um deploy novo aparece no primeiro recarregamento — sem aluno preso em versão antiga.

### 9.4 Vale a pena?

| | Tudo num host só (seções 4–7) | Interface na Netlify |
| --- | --- | --- |
| Passos de deploy | 1 | 2 (API + front) |
| Domínio único, sem CORS | sim | sim (opção A) |
| Geração por IA longa | sempre funciona | só na opção B |
| Rollback / preview por branch | o do host | melhor da categoria |
| Custo | 1 host | 1 host + Netlify (grátis até ~15 GB) |

Para uma turma de medicina usando casos prontos e revisão, a **opção A entrega o que o aluno precisa** com um deploy a mais. Para criar casos por IA com frequência, vá de **opção B** — ou simplesmente mantenha tudo no mesmo host.

---

## 10. Checklist depois do deploy

```bash
# 1. Servidor vivo
curl -s https://SEU-ENDERECO/api/health
# {"ok":true,...,"demo":false}

# 2. Busca pública nos acervos (precisa de saída para a internet no servidor)
curl -s "https://SEU-ENDERECO/api/discovery/search?q=sepsis&limit=2" | head -c 400

# 3. Se estiver usando Docker: teste ao vivo rodando DENTRO do container
docker compose exec app npm run test:discovery:live -- --probe
```

Na interface:

- [ ] `/login` → **Criar agora** funciona e o botão “Entrar como demo” **não** aparece (com `SEED_DEMO=0`).
- [ ] `/descobrir` abre **sem login** e a busca retorna resultados de pelo menos dois acervos.
- [ ] Login → envie um PDF pequeno → análise aparece → gerar casos.
- [ ] Recarregue a página logado: a sessão continua (cookie `Secure` em HTTPS).
- [ ] Reinicie o serviço (`docker compose restart app`) e confirme que materiais/casos continuam lá.

---

## 11. Backup e restauração

`npm run db:backup` usa `VACUUM INTO`: gera uma cópia íntegra **com o servidor rodando** (copiar o `.db` na mão pode capturar um estado inconsistente do WAL).

```bash
# dentro do container
docker compose exec app npm run db:backup
# ou apontando para fora do volume
BACKUP_DIR=/var/backups/studyflux docker compose exec -T app npm run db:backup
```

Agende com cron (todo dia às 3h, mantendo 14 cópias):

```cron
0 3 * * * cd /opt/study-flux && BACKUP_DIR=/var/backups/studyflux BACKUP_KEEP=14 docker compose exec -T app npm run db:backup >> /var/log/studyflux-backup.log 2>&1
```

**Restaurar:**

```bash
docker compose stop app
docker run --rm -v studyflux-data:/data -v "$PWD":/backup alpine \
  sh -c "cp /backup/studyflux-2026-10-28T03-00-00.db /data/studyflux.db && rm -f /data/studyflux.db-wal /data/studyflux.db-shm"
docker compose start app
```

No Render/Fly, além do `db:backup`, use o snapshot do disco do provedor.

---

## 12. Segurança e uso com alunos

- **HTTPS é obrigatório** em produção: sem ele o cookie de sessão viaja em claro (`COOKIE_SECURE=auto` só marca `Secure` quando a conexão é HTTPS).
- **`SEED_DEMO=0`** evita que todos entrem na mesma conta de demonstração.
- **`APP_SECRET` fixo** (variável de ambiente) mantém sessões válidas entre reinícios e evita reconfigurar a chave de IA.
- **Uma instância só.** Rodar duas réplicas contra o mesmo SQLite corrompe dados; para escalar, migre para Postgres.
- **Dados pessoais:** nome, e-mail e histórico de estudo ficam no seu banco. Se o uso for institucional, publique um aviso de privacidade, defina prazo de retenção e ofereça exportação (já existe export CSV em Progresso e backup por material).
- **Conteúdo de terceiros:** a busca só importa fontes abertas e guarda licença e link de origem; material pago não é baixado. Reforce com os alunos que casos derivados de obra alheia não devem ser redistribuídos fora da turma.
- **Limites já embutidos:** upload 25 MB, JSON 3 MB, 12 MB por resposta externa, 30 buscas anônimas/5 min por visitante, bloqueio de SSRF na importação por link.

---

## 13. Quando migrar de SQLite

| Sinal | Ação |
| --- | --- |
| Uma turma, dezenas de alunos | SQLite está ótimo — é justamente o cenário atual |
| Precisa de duas ou mais réplicas / HA | Postgres (`node:sqlite` → `pg`; queries já são SQL padrão) |
| Uploads grandes acumulando | mover arquivos para S3/R2 e guardar só o texto no banco |
| PDFs de 20+ MB travando o servidor | fila/job assíncrono (`jobs` + worker) em vez de processar na requisição |
| Muitos usuários simultâneos na busca | cache persistente (SQLite/Redis) e rate limit por conta |

---

## 14. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Busca em acervos diz “não foi possível alcançar” | servidor sem saída para a internet (proxy corporativo, firewall, ambiente de preview) | liberar egress 443 para `ebi.ac.uk`, `eutils.ncbi.nlm.nih.gov`, `api.openalex.org` |
| Login “não gruda” / volta para a tela de login | `COOKIE_SECURE=always` servindo em HTTP, ou proxy sem `TRUST_PROXY` | usar `COOKIE_SECURE=auto` e `TRUST_PROXY=1` |
| Todos os dados sumiram após deploy | volume não montado em `/data` (ou plano free do Render) | conferir `DATA_DIR=/data` e o mount do disco |
| `EACCES` ao gravar em `/data` | volume montado como root e container sem permissão | o `docker-entrypoint.sh` já ajusta o dono do volume quando inicia como root; se você sobrescreveu o `user:` no compose, remova ou use `user: root` |
| Interface abre em branco | `web/dist` não foi construído na imagem | conferir o estágio `build` (o Dockerfile já roda `npm run build`) |
| Limite de busca anônima atingido por toda a turma | todos atrás do mesmo NAT/proxy e `TRUST_PROXY=0` | `TRUST_PROXY=1` para o app ler `X-Forwarded-For` |
