import express from 'express';
import path from 'path';
import { db, ensureDefaultSettings, migrate } from './db';
import { errorHandler, parseCookies, requireDentist } from './middleware';
import { api } from './routes/api';
import { authRoutes } from './routes/auth';
import { ensureDentistUser } from './services/auth';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');

migrate();
ensureDefaultSettings();
ensureDentistUser();

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(parseCookies);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', api);

app.use(express.static(PUBLIC_DIR, { extensions: [] }));

const page = (file: string) => (_req: express.Request, res: express.Response) =>
  res.sendFile(path.join(PUBLIC_DIR, file));

app.get('/', page('index.html'));
app.get('/cliente', page('cliente.html'));
app.get('/cliente/*', page('cliente.html'));
app.get('/dentista', requireDentist, page('dentista.html'));
app.get('/dentista/*', requireDentist, page('dentista.html'));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({
      ok: false,
      error: { code: 'not_found', message: 'Recurso não encontrado.' }
    });
    return;
  }
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`\n  OdontoCare rodando em http://localhost:${PORT}`);
    console.log(`  Site publico ......... http://localhost:${PORT}/`);
    console.log(`  Portal do cliente .... http://localhost:${PORT}/cliente`);
    console.log(`  Painel do dentista ... http://localhost:${PORT}/dentista\n`);
  });
  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
