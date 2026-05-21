import { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';

function toSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function mapKeys(obj: any, mapper: (s: string) => string): any {
  if (Array.isArray(obj)) return obj.map(v => mapKeys(v, mapper));
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[mapper(key)] = mapKeys(obj[key], mapper);
      return acc;
    }, {} as any);
  }
  return obj;
}

const sanitizeData = (val: any): any => {
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return null;
  if (typeof val === 'object' && !(val instanceof Date)) {
    return JSON.stringify(val);
  }
  if (val instanceof Date) return val.toISOString();
  return val;
};

export class ConfigRepository {
    private primaryDb: Database;
    private statutoryDb: Database;
    
    constructor(primaryDb: Database, statutoryDb: Database) {
        this.primaryDb = primaryDb;
        this.statutoryDb = statutoryDb;
    }

    getCompanyConfig(moduleType: string) {
        const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
        const row = db.prepare('SELECT * FROM company_config WHERE id = 1').get() as any;
        if (row) {
            const configData = { ...row };
            if (typeof configData.bank_accounts === 'string') {
                try { configData.bank_accounts = JSON.parse(configData.bank_accounts); } catch (e) { configData.bank_accounts = []; }
            }
            if (typeof configData.signatories === 'string') {
                try { configData.signatories = JSON.parse(configData.signatories); } catch (e) { configData.signatories = []; }
            }
            return configData;
        } else {
            if (moduleType === 'P') {
                const kRow = this.primaryDb.prepare('SELECT * FROM company_config WHERE id = 1').get() as any;
                if (kRow) {
                    const configData = { ...kRow };
                    if (typeof configData.bank_accounts === 'string') {
                        try { configData.bank_accounts = JSON.parse(configData.bank_accounts); } catch (e) { configData.bank_accounts = []; }
                    }
                    if (typeof configData.signatories === 'string') {
                        try { configData.signatories = JSON.parse(configData.signatories); } catch (e) { configData.signatories = []; }
                    }
                    return configData;
                }
            }
            return null;
        }
    }

    saveCompanyConfig(config: any, moduleType: string) {
        const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
        const snakeData = mapKeys(config, toSnakeCase);

        if (snakeData.bank_accounts && typeof snakeData.bank_accounts !== 'string') {
            snakeData.bank_accounts = JSON.stringify(snakeData.bank_accounts);
        }
        if (snakeData.signatories && typeof snakeData.signatories !== 'string') {
            snakeData.signatories = JSON.stringify(snakeData.signatories);
        }

        const columns = db.prepare("PRAGMA table_info(company_config)").all() as any[];
        const columnNames = columns.map(c => c.name);
        const keys = Object.keys(snakeData).filter(k => columnNames.includes(k) && k !== 'id');
        const values = keys.map(k => sanitizeData(snakeData[k]));

        const sql = `INSERT OR REPLACE INTO company_config (id, ${keys.join(', ')}) VALUES (1, ${keys.map(() => '?').join(', ')})`;
        db.prepare(sql).run(...values);

        if (moduleType === 'K') {
            try {
                this.statutoryDb.prepare(sql).run(...values);
            } catch (mirrorErr) {
                console.warn('Failed to mirror company_config', mirrorErr);
            }
        }
    }

    getPayrollRules() {
        const row = this.primaryDb.prepare('SELECT * FROM company_payroll_rules WHERE id = 1').get() as any;
        if (row) {
            return row;
        } else {
            return { k_salary_calculation_source: 'EMPLOYEE_MASTER' };
        }
    }

    updatePayrollRules(rules: any, userId: string | null) {
        if (!rules || !rules.k_salary_calculation_source) {
            throw new Error('Invalid payload');
        }
        
        let oldSource = 'EMPLOYEE_MASTER';
        try {
            const oldRow = this.primaryDb.prepare('SELECT k_salary_calculation_source FROM company_payroll_rules WHERE id = 1').get() as any;
            if (oldRow && oldRow.k_salary_calculation_source) {
                oldSource = oldRow.k_salary_calculation_source;
            }
        } catch (e) {}

        this.primaryDb.prepare(`
            INSERT OR REPLACE INTO company_payroll_rules (id, k_salary_calculation_source, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
        `).run(rules.k_salary_calculation_source);
        
        if (oldSource !== rules.k_salary_calculation_source) {
            this.primaryDb.prepare(`
                INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                randomUUID(),
                userId,
                'UPDATE',
                'payroll_engine_source',
                'company_payroll_rules',
                JSON.stringify({
                    field: 'k_salary_calculation_source',
                    old_value: oldSource,
                    new_value: rules.k_salary_calculation_source
                })
            );
        }
    }
}
