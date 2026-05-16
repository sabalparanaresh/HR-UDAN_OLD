import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';

export function auditMiddleware(db: Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    res.send = function (body: any) {
      if (req.method !== 'GET' && res.statusCode >= 200 && res.statusCode < 300) {
        // Log action
        try {
          const stmt = db.prepare(`INSERT INTO audit_logs (entity, action, user_id) VALUES (?, ?, ?)`);
          stmt.run(req.path, req.method, req.headers['x-user-id'] || 'system');
        } catch (e) {
          console.error('[Audit]', e);
        }
      }
      return originalSend.call(this, body);
    };
    next();
  };
}
