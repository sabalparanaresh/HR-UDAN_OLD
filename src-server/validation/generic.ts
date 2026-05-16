import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody(schema: z.ZodType<any, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (e: any) {
      return res.status(400).json({ error: e.errors || 'Validation Failed' });
    }
  };
}
