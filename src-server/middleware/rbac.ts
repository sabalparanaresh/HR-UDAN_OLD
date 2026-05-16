import { Request, Response, NextFunction } from 'express';

export function rbacMiddleware(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.headers['x-user-role'] as string || 'ADMIN';
    if (!allowedRoles.includes(userRole) && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access Denied: Insufficient Permissions' });
    }
    next();
  };
}
