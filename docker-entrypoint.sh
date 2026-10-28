#!/bin/sh
# Volumes criados pelo provedor costumam nascer com dono root. Quando o container
# está rodando como root, ajustamos o dono do diretório de dados e caímos para o
# usuário `node` (uid 1000) antes de iniciar a aplicação.
set -e

DATA_DIR="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
  exec gosu node "$@"
fi

exec "$@"
