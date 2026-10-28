import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { PORT, WEB_DIST } from './config';
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
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Study Flux', version: '0.1.0', time: new Date().toISOString() });
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
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof AIError) {
    res.status(error.status).json({ error: error.message });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Flux API em http://0.0.0.0:${PORT}`);
  console.log(`Conta demo: demo@studyflux.app / estudar123`);
});
