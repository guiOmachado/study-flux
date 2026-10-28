import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { CORS_ORIGINS, DATA_DIR, PORT, SEED_DEMO, TRUST_PROXY, WEB_DIST } from './config';
import { attachUser } from './auth';
import { authRouter } from './routes/auth';
import { sourcesRouter } from './routes/sources';
import { casesRouter } from './routes/cases';
import { generateRouter } from './routes/generate';
import { attemptsRouter } from './routes/attempts';
import { srsRouter } from './routes/srs';
import { statsRouter } from './routes/stats';
import { settingsRouter } from './routes/settings';
import { discoveryRouter } from './routes/discovery';
import { ensureSeeded } from './seed';
import { AIError } from './generation/llm';

const app = express();
app.disable('x-powered-by');
// Em preview/PaaS o app roda atrás de proxy: confiar em 1 salto permite limitar busca anônima
// por visitante e detectar HTTPS. Em rede local sem proxy, defina TRUST_PROXY=0.
app.set('trust proxy', TRUST_PROXY);

/**
 * CORS opcional: só entra em ação com `CORS_ORIGIN` configurado (interface em
 * outro domínio, ex.: Netlify). Mesma origem continua sem cabeçalhos extras.
 * O cookie de sessão é enviado com `Access-Control-Allow-Credentials`.
 */
if (CORS_ORIGINS.length > 0) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = origin && CORS_ORIGINS.includes(origin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'content-type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS' && allowed) {
      res.status(204).end();
      return;
    }
    next();
  });
}

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'Study Flux',
    version: '0.1.0',
    time: new Date().toISOString(),
    // Exposto para a interface esconder o botão "Entrar como demo" em deploy público.
    demo: SEED_DEMO,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/cases', casesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/srs', srsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/discovery', discoveryRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota de API não encontrada.' });
});

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html') || req.path.startsWith('/api')) return next();
    // Arquivo com extensão que não existe (ex.: /casos/main-abc.js) é 404, não index.html:
    // devolver HTML para um <script> quebra a página em silêncio.
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof AIError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const details = error as { type?: string; status?: number };
  if (details?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Conteúdo muito grande. O limite é 3 MB para JSON e 25 MB para arquivos.' });
    return;
  }
  if (details?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
    return;
  }
  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  if (message.includes('Formato não suportado') || message.includes('File too large')) {
    res.status(400).json({ error: message.replace('File too large', 'Arquivo muito grande (limite de 25 MB).') });
    return;
  }
  console.error('[erro]', error);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

ensureSeeded();

if (!fs.existsSync(WEB_DIST)) {
  console.warn('[aviso] web/dist não encontrado — rode `npm run build` para servir a interface.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Flux API em http://0.0.0.0:${PORT}`);
  console.log(`Dados: ${DATA_DIR} · APP_SECRET: ${process.env.APP_SECRET ? 'variável de ambiente' : `arquivo ${DATA_DIR}/app.secret`}`);
  console.log(`Proxy confiável: ${TRUST_PROXY === false ? 'desligado' : `${TRUST_PROXY} salto(s)`} · conta demo: ${SEED_DEMO ? 'ativa' : 'desativada'}`);
  if (SEED_DEMO) console.log('Conta demo: demo@studyflux.app / estudar123');
});
