import { Request, Response } from 'express';
import { Database } from 'better-sqlite3';

export interface CommandContext {
  primaryDb: Database;
  statutoryDb: Database;
  req: Request;
  res: Response;
}

export type CommandHandler = (ctx: CommandContext, args: any) => void | Promise<void> | any | Promise<any>;
