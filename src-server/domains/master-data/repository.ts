import { CRUD_TABLE_WHITELIST } from '../../db/whitelists.js';

export class MasterDataRepository {
  private db: any;

  constructor(db: any) {
    if (!db) throw new Error('Database instance is required');
    this.db = db;
  }

  public findAll(tableName: string, offset: number = 0, limit: number = 50): any[] {
    this.validateTable(tableName);
    return this.db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);
  }

  public findById(tableName: string, id: string | number, idColumn: string = 'id'): any {
    this.validateTable(tableName);
    return this.db.prepare(`SELECT * FROM ${tableName} WHERE ${idColumn} = ?`).get(id);
  }

  public create(tableName: string, data: Record<string, any>): { lastInsertRowid: number | bigint } {
    this.validateTable(tableName);
    const columnsInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const validColumns = columnsInfo.map(c => c.name);
    
    const filteredData: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && key !== 'id') {
        filteredData[key] = data[key];
      }
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) throw new Error("No valid columns to insert");

    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const values = keys.map(k => filteredData[k]);
    
    return this.db.prepare(sql).run(...values);
  }

  public update(tableName: string, id: string | number, data: Record<string, any>, idColumn: string = 'id'): any {
    this.validateTable(tableName);
    const columnsInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const validColumns = columnsInfo.map(c => c.name);
    
    const filteredData: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && key !== idColumn) {
        filteredData[key] = data[key];
      }
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) throw new Error("No valid columns to update");

    const sql = `UPDATE ${tableName} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE ${idColumn} = ?`;
    const values = keys.map(k => filteredData[k]);
    values.push(id as any);
    
    return this.db.prepare(sql).run(...values);
  }

  public delete(tableName: string, id: string | number, idColumn: string = 'id'): any {
    this.validateTable(tableName);
    return this.db.prepare(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`).run(id);
  }

  private validateTable(tableName: string) {
    if (!CRUD_TABLE_WHITELIST.includes(tableName)) {
      throw new Error(`Access denied. Unauthorized table: ${tableName}`);
    }
  }
}
