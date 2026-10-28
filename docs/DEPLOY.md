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

**Conclusão:** container (Docker) ou máquina virtual com volume. **Netlify/Vercel não servem** para este backend — são CDN + funções efêmeras, com disco somente leitura, payload de 6 MB e timeout curto. O front até poderia ir para lá, mas o ganho é zero quando comparado a servir tudo pelo mesmo processo.

O repositório já vem com os arquivos prontos:

```
Dockerfile             imagem de produção (multi-stage, non-root, healthcheck)
docker-compose.yml     execução local/VPS com volume persistente
render.yaml            blueprint do Render (com disco)
fly.toml               configuração do Fly.io (com volume)
scripts/backup.mjs     backup consistente do SQLite (npm run db:backup)
```

---

## 2. Opções, do mais simples ao mais controlável

| Caminho | Esforço | Custo | Dados persistem? | Bom para |
| --- | --- | --- | --- | --- |
| **Cloudflare Tunnel + seu PC** | ~10 min | grátis | sim (no seu disco) | testar com uma turma **hoje**, sem contratar nada |
| **Render (blueprint)** | ~15 min | plano pago por causa do disco | sim | piloto com pouca manutenção |
| **Fly.io** | ~20 min | baixo (volume + VM pequena) | sim | produção pequena, HTTPS e região no Brasil (`gru`) |
| **VPS + Docker Compose + Caddy** | ~40 min | preço de uma VPS | sim | controle total, domínio próprio, turma inteira |

> Regra prática: se você quer **só mostrar**, use o túnel. Se quer **usar com alunos por semanas**, Render ou Fly. Se quer **domínio da faculdade e soberania dos dados**, VPS.

---

## 3. Variáveis de ambiente

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `8787` | Porta HTTP (o Render/Fly injetam a dele; o app respeita). |
| `DATA_DIR` | `./data` (na imagem: `/data`) | Onde ficam `studyflux.db` e `app.secret`. **Precisa ser o volume.** |
| `APP_SECRET` | gerado em `DATA_DIR/app.secret` | Assina sessões e cifra a chave de IA. Em produção, defina para não depender do arquivo. |
| `SEED_DEMO` | `1` | `0` desativa a conta demo **e** esconde o botão “Entrar como demo”. **Use `0` em deploy público.** |
| `COOKIE_SECURE` | `auto` | `auto` marca o cookie como `Secure` quando a requisição chega por HTTPS. `always` força; `never` só para depuração. |
| `TRUST_PROXY` | `1` | Confia em 1 salto de proxy (Caddy, Render, Fly, Cloudflare) para IP real e HTTPS. Use `0` sem proxy. |
| `OPENALEX_MAILTO` | — | E-mail de contato enviado ao OpenAlex (boa prática de uso da API). |

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
2. Ajuste `plan` se necessário: **disco persistente exige plano pago** (Starter+). No plano free o SQLite seria apagado a cada deploy.
3. Preencha `OPENALEX_MAILTO` quando pedir (é `sync: false`).
4. Deploy. O healthcheck usa `/api/health`; a porta vem de `PORT`.

O blueprint já define `SEED_DEMO=0`, `DATA_DIR=/data`, disco de 1 GB montado em `/data` e `APP_SECRET` gerado pelo próprio Render.

> Se um dia o app crescer, confira o tamanho do volume: cada material guarda o texto extraído, então 1 GB atende com folga uma turma, mas acompanhe.

---

## 6. Caminho C — Fly.io

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

## 7. Caminho D — Sem servidor: túnel do seu computador

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

## 8. Checklist depois do deploy

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

## 9. Backup e restauração

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

## 10. Segurança e uso com alunos

- **HTTPS é obrigatório** em produção: sem ele o cookie de sessão viaja em claro (`COOKIE_SECURE=auto` só marca `Secure` quando a conexão é HTTPS).
- **`SEED_DEMO=0`** evita que todos entrem na mesma conta de demonstração.
- **`APP_SECRET` fixo** (variável de ambiente) mantém sessões válidas entre reinícios e evita reconfigurar a chave de IA.
- **Uma instância só.** Rodar duas réplicas contra o mesmo SQLite corrompe dados; para escalar, migre para Postgres.
- **Dados pessoais:** nome, e-mail e histórico de estudo ficam no seu banco. Se o uso for institucional, publique um aviso de privacidade, defina prazo de retenção e ofereça exportação (já existe export CSV em Progresso e backup por material).
- **Conteúdo de terceiros:** a busca só importa fontes abertas e guarda licença e link de origem; material pago não é baixado. Reforce com os alunos que casos derivados de obra alheia não devem ser redistribuídos fora da turma.
- **Limites já embutidos:** upload 25 MB, JSON 3 MB, 12 MB por resposta externa, 30 buscas anônimas/5 min por visitante, bloqueio de SSRF na importação por link.

---

## 11. Quando migrar de SQLite

| Sinal | Ação |
| --- | --- |
| Uma turma, dezenas de alunos | SQLite está ótimo — é justamente o cenário atual |
| Precisa de duas ou mais réplicas / HA | Postgres (`node:sqlite` → `pg`; queries já são SQL padrão) |
| Uploads grandes acumulando | mover arquivos para S3/R2 e guardar só o texto no banco |
| PDFs de 20+ MB travando o servidor | fila/job assíncrono (`jobs` + worker) em vez de processar na requisição |
| Muitos usuários simultâneos na busca | cache persistente (SQLite/Redis) e rate limit por conta |

---

## 12. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Busca em acervos diz “não foi possível alcançar” | servidor sem saída para a internet (proxy corporativo, firewall, ambiente de preview) | liberar egress 443 para `ebi.ac.uk`, `eutils.ncbi.nlm.nih.gov`, `api.openalex.org` |
| Login “não gruda” / volta para a tela de login | `COOKIE_SECURE=always` servindo em HTTP, ou proxy sem `TRUST_PROXY` | usar `COOKIE_SECURE=auto` e `TRUST_PROXY=1` |
| Todos os dados sumiram após deploy | volume não montado em `/data` (ou plano free do Render) | conferir `DATA_DIR=/data` e o mount do disco |
| `EACCES` ao gravar em `/data` | volume montado como root e container sem permissão | o `docker-entrypoint.sh` já ajusta o dono do volume quando inicia como root; se você sobrescreveu o `user:` no compose, remova ou use `user: root` |
| Interface abre em branco | `web/dist` não foi construído na imagem | conferir o estágio `build` (o Dockerfile já roda `npm run build`) |
| Limite de busca anônima atingido por toda a turma | todos atrás do mesmo NAT/proxy e `TRUST_PROXY=0` | `TRUST_PROXY=1` para o app ler `X-Forwarded-For` |
