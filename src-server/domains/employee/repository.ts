export class EmployeeRepository {
  private db: any;

  constructor(db: any) {
    if (!db) throw new Error('Database instance is required');
    this.db = db;
  }

  public findAll(type: 'WAGE' | 'STATUTORY', limit: number = 50, offset: number = 0): any[] {
    const rateCol = type === 'STATUTORY' ? 'statutory_wage_amount' : 'wage_amount';
    const sql = `
      SELECT e.*, 
        COALESCE(
          (SELECT amount FROM salary_rate_history h 
           WHERE h.emp_id = e.id AND h.type = ? 
           ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
          e.${rateCol}
        ) as ${rateCol},
        COALESCE(
          (SELECT effective_date FROM salary_rate_history h 
           WHERE h.emp_id = e.id AND h.type = ? 
           ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
          e.wage_effective_from
        ) as wage_effective_from
      FROM employees e
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(sql).all(type, type, limit, offset);
  }

  public findById(id: number | string, type: 'WAGE' | 'STATUTORY'): any {
    const rateCol = type === 'STATUTORY' ? 'statutory_wage_amount' : 'wage_amount';
    const sql = `
      SELECT e.*, 
        COALESCE(
          (SELECT amount FROM salary_rate_history h 
           WHERE h.emp_id = e.id AND h.type = ? 
           ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
          e.${rateCol}
        ) as ${rateCol},
        COALESCE(
          (SELECT effective_date FROM salary_rate_history h 
           WHERE h.emp_id = e.id AND h.type = ? 
           ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
          e.wage_effective_from
        ) as wage_effective_from
      FROM employees e
      WHERE e.id = ?
    `;
    return this.db.prepare(sql).get(type, type, id);
  }

  public create(data: Record<string, any>): { lastInsertRowid: number | bigint } {
    const columnsInfo = this.db.prepare(`PRAGMA table_info(employees)`).all() as any[];
    const validColumns = columnsInfo.map(c => c.name);
    
    const filteredData: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && key !== 'id') {
        filteredData[key] = data[key];
      }
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) throw new Error("No valid columns to insert");

    const sql = `INSERT INTO employees (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const values = keys.map(k => filteredData[k]);
    
    return this.db.prepare(sql).run(...values);
  }

  public update(id: number | string, data: Record<string, any>): any {
    const columnsInfo = this.db.prepare(`PRAGMA table_info(employees)`).all() as any[];
    const validColumns = columnsInfo.map(c => c.name);
    
    const filteredData: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && key !== 'id') {
        filteredData[key] = data[key];
      }
    }

    const keys = Object.keys(filteredData);
    if (keys.length === 0) throw new Error("No valid columns to update");

    const sql = `UPDATE employees SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    const values = keys.map(k => filteredData[k]);
    values.push(id as any);
    
    return this.db.prepare(sql).run(...values);
  }

  public delete(id: number | string): any {
    return this.db.prepare(`DELETE FROM employees WHERE id = ?`).run(id);
  }
}
