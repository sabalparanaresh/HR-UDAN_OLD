import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { employeeRouter } from './src-server/domains/employee/routes.js';
import { attendanceRouter } from './src-server/domains/attendance/routes.js';
import { masterDataRouter } from './src-server/domains/master-data/routes.js';
import { bootstrapDatabase } from './src-server/db/bootstrap.js';
import { rpcRouter, setupLegacyEventStream } from './src-server/domains/rpc/routes.js';
import { runPostSetupMigrations } from './src-server/db/migrations.js';
// Domain routes

import { systemRouter } from './src-server/domains/system/routes.js';
import { configRouter } from './src-server/domains/config/routes.js';
import { reportsRouter } from './src-server/domains/reports/routes.js';
import { authRouter } from './src-server/domains/auth/routes.js';
import { usermanagementRouter } from './src-server/domains/user-management/routes.js';
import { pieceRateRouter } from './src-server/domains/piece-rate/routes.js';
import { syncengineRouter } from './src-server/domains/sync-engine/routes.js';
import { loansRouter } from './src-server/domains/loans/routes.js';
import { canteenRouter } from './src-server/domains/canteen/routes.js';
import { bankingRouter } from './src-server/domains/banking/routes.js';
import { payrollRouter } from './src-server/domains/payroll/routes.js';
import { transactionsRouter } from './src-server/domains/transactions/routes.js';

const app = express();
const PORT = 3000;

const HOST = '0.0.0.0';

app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.text({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

import { errorHandler } from './src-server/middleware/errorHandler.js';
import { auditMiddleware } from './src-server/middleware/audit.js';
import { securityHeadersMiddleware } from './src-server/middleware/security.js';

app.use(securityHeadersMiddleware);

// Start Legacy Subsystems and DB
bootstrapDatabase().then(({ primaryDb, statutoryDb, dbState }: any) => {
  setupLegacyEventStream(app);
  // Inject DBs
  app.use('/api', (req, res, next) => {
    (req as any).primaryDb = primaryDb;
    (req as any).statutoryDb = statutoryDb;
    (req as any).dbState = dbState;
    next();
  });

  app.use('/api', auditMiddleware(primaryDb));

  // Mount Domain Routers (New layered architecture)
  app.use('/api/employee', employeeRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/master-data', masterDataRouter);
  app.use('/', rpcRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/config', configRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usermanagementRouter);
  app.use('/api/sync', syncengineRouter);
  app.use('/api/salary-settings/piece-rate', pieceRateRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/loans', loansRouter);
  app.use('/api/canteen', canteenRouter);
  app.use('/api/banking', bankingRouter);
  app.use('/api/payroll', payrollRouter);
  
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

  app.use(errorHandler);

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
