# syntax=docker/dockerfile:1

# ---------- build da interface ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY web ./web
RUN npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data

WORKDIR /app

# Só dependências de runtime (tsx está em dependencies porque `npm start` roda TS direto).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/web/dist ./web/dist
COPY shared ./shared
COPY server ./server
# scripts/backup.mjs (npm run db:backup) e scripts/test-discovery-live.ts (--probe) são usados em produção
COPY scripts ./scripts
COPY tsconfig.json ./

# gosu permite ajustar o dono do volume e então rodar como `node` (uid 1000).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

# /data guarda o SQLite e o segredo de sessão: precisa ser um volume persistente.
RUN mkdir -p /data && chown -R node:node /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8787
VOLUME ["/data"]

ENTRYPOINT ["docker-entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "const p=process.env.PORT||8787;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
