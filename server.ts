import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { startLegacyServer } from './src-server/legacyRouter.js';
import { runPostSetupMigrations } from './src-server/db/migrations.js';
// Domain routes
import { employeeRouter } from './src-server/domains/employee/routes.js';
import { attendanceRouter } from './src-server/domains/attendance/routes.js';
import { payrollkRouter } from './src-server/domains/payroll-k/routes.js';
import { payrollpRouter } from './src-server/domains/payroll-p/routes.js';
import { reportsRouter } from './src-server/domains/reports/routes.js';
import { mastersRouter } from './src-server/domains/masters/routes.js';
import { usermanagementRouter } from './src-server/domains/user-management/routes.js';
import { pieceRateRouter } from './src-server/domains/piece-rate/routes.js';
import { syncengineRouter } from './src-server/domains/sync-engine/routes.js';
import { productionEntryRouter } from './src-server/domains/transactions/production-entry/routes.js';

const app = express();
const PORT = 3000;

const HOST = process.env.IS_TAURI || process.env.PLATFORM === 'TAURI' ? '127.0.0.1' : '0.0.0.0';

app.use((req, res, next) => {
  // Reject external network requests in Tauri context
  if ((process.env.IS_TAURI || process.env.PLATFORM === 'TAURI') && req.ip && req.ip !== '127.0.0.1' && req.ip !== '::1' && req.ip !== '::ffff:127.0.0.1') {
    return res.status(403).send('Forbidden: External requests are not allowed.');
  }
  next();
});

app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.text({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR CAUGHT:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// Start Legacy Subsystems and DB
startLegacyServer(app, false).then(({ primaryDb, statutoryDb, dbState, setupRoutes, server }: any) => {
  // Inject DBs
  app.use('/api', (req, res, next) => {
    (req as any).primaryDb = primaryDb;
    (req as any).statutoryDb = statutoryDb;
    (req as any).dbState = dbState;
    next();
  });

  // Mount Domain Routers (New layered architecture)
  app.use('/api/employee', employeeRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/payroll/k', payrollkRouter);
  app.use('/api/payroll/p', payrollpRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/masters', mastersRouter);
  app.use('/api/users', usermanagementRouter);
  app.use('/api/sync', syncengineRouter);
  app.use('/api/salary-settings/piece-rate', pieceRateRouter);
  app.use('/api/transactions/production-entry', productionEntryRouter);
  
  // Catch-all for unhandled API routes
  app.post('/api/ping', (req, res) => {
    res.json({
      headers: req.headers,
      body: req.body,
      isString: typeof req.body === 'string'
    });
  });

  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `from server.ts API route ${req.method} ${req.path} not found` });
  });

  // If Vite setup isn't handled by legacy, do it here
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist'));
  if (!isProduction) {
    createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      app.use(async (req, res, next) => {
        if (req.originalUrl.startsWith('/api')) return next();
        vite.middlewares(req, res, async (err: any) => {
          if (err) return next(err);
          try {
            let template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          } catch (e) {
            vite.ssrFixStacktrace(e as Error);
            next(e);
          }
        });
      });
      console.log(`Tauri-Emulator Server running on http://${HOST}:${PORT} (Vite mode)`);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    console.log(`Tauri-Emulator Server running on http://${HOST}:${PORT} (Prod mode)`);
  }
}).catch((err: any) => {
  console.error('[Startup Error]', err);
  process.exit(1);
});
