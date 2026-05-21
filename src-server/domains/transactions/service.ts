import { Database } from 'better-sqlite3';
import { RokdaRepository, MisRepository } from './repository.js';
import { logError } from '../../utils/logger.js';

export class TransactionsService {
  primaryDb: Database;
  statutoryDb: Database;

  constructor(primaryDb: Database, statutoryDb: Database) {
    this.primaryDb = primaryDb;
    this.statutoryDb = statutoryDb;
  }

  getDb(moduleType: 'K' | 'P'): Database {
    return moduleType === 'P' ? this.statutoryDb : this.primaryDb;
  }

  getNextRokdaToken(prefix: string, moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    try {
      const repo = new RokdaRepository(db);
      return repo.getNextToken(prefix);
    } catch (e) {
      logError(db, 'ERROR', `Failed to generate next Rokda token for prefix ${prefix}`, e);
      return `${prefix}001`;
    }
  }

  saveRokdaVoucher(voucher: any, entries: any[], moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    try {
      const repo = new RokdaRepository(db);
      return repo.saveVoucher(voucher, entries);
    } catch (e) {
      logError(db, 'ERROR', '[Database] saveRokdaVoucher error', e);
      throw new Error('Failed to save Rokda voucher');
    }
  }

  saveMisVoucher(voucher: any, entries: any[], moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    try {
      const repo = new MisRepository(db);
      return repo.saveVoucher(voucher, entries);
    } catch (e) {
      logError(db, 'ERROR', '[Database] saveMisVoucher error', e);
      throw new Error('Failed to save MIS voucher');
    }
  }
}
