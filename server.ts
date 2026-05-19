import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { startLegacyServer } from './src-server/legacyRouter.js';
import { runPostSetupMigrations } from './src-server/db/migrations.js';
// Domain routes

import { usermanagementRouter } from './src-server/domains/user-management/routes.js';
import { pieceRateRouter } from './src-server/domains/piece-rate/routes.js';
import { syncengineRouter } from './src-server/domains/sync-engine/routes.js';
import { productionEntryRouter } from './src-server/domains/transactions/production-entry/routes.js';

const app = express();
const PORT = 3000;

const HOST = '0.0.0.0';

app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.text({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((err: any, req: any, res: any, next: any) => {
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

  app.all(/^\/api\/.*/, (req: any, res: any) => {
    res.status(404).json({ error: `from server.ts API route ${req.method} ${req.path} not found` });
  });

  // If Vite setup isn't handled by legacy, do it here
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist'));
  if (!isProduction) {
    createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      // Use vite's connect instance as middleware
      app.use(vite.middlewares);

      app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT} (Vite mode)`);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT} (Prod mode)`);
    });
  }
}).catch((err: any) => {
  console.error('[Startup Error]', err);
  process.exit(1);
});
