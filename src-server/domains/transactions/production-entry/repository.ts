import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface ProductionInvoice {
    id: string;
    invoice_no: string;
    emp_id: number;
    month_year: string;
    gross_amount: number;
    deduction_amount: number;
    net_amount: number;
    status: string;
    approved_by?: string;
    approved_at?: string;
    created_by: string;
    updated_by: string;
    created_at?: string;
    updated_at?: string;
}

export interface ProductionInvoiceDetail {
    id: string;
    invoice_id: string;
    head_id: string;
    head_name: string;
    type: string;
    quantity: number;
    rate: number;
    amount: number;
}

export class ProductionEntryRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
        this.initializeSchema();
    }

    private initializeSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS production_invoices (
                id TEXT PRIMARY KEY,
                invoice_no TEXT UNIQUE NOT NULL,
                emp_id INTEGER NOT NULL,
                month_year TEXT NOT NULL,
                gross_amount REAL DEFAULT 0,
                deduction_amount REAL DEFAULT 0,
                net_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'DRAFT',
                approved_by TEXT,
                approved_at DATETIME,
                created_by TEXT,
                updated_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(emp_id) REFERENCES employees(id)
            );

            CREATE TABLE IF NOT EXISTS production_invoice_details (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                head_id TEXT,
                head_name TEXT NOT NULL,
                type TEXT NOT NULL,
                quantity REAL NOT NULL DEFAULT 1,
                rate REAL NOT NULL DEFAULT 0,
                amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY(invoice_id) REFERENCES production_invoices(id) ON DELETE CASCADE
            );
        `);
    }

    private generateInvoiceNo(): string {
        const row = this.db.prepare(
            `SELECT invoice_no FROM production_invoices ORDER BY ROWID DESC LIMIT 1`
        ).get() as { invoice_no: string } | undefined;
        if (!row) return 'PRD-1001';
        const lastNum = parseInt(row.invoice_no.split('-')[1] || '1000', 10);
        return `PRD-${lastNum + 1}`;
    }

    getList(page: number, limit: number, search?: string) {
        const offset = (page - 1) * limit;
        let query = `
            SELECT p.*, e.name as emp_name, e.emp_code
            FROM production_invoices p
            JOIN employees e ON p.emp_id = e.id
        `;
        const params: any[] = [];

        if (search) {
            query += ` WHERE e.name LIKE ? OR e.emp_code LIKE ? OR p.invoice_no LIKE ? OR p.month_year LIKE ?`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const data = this.db.prepare(query).all(...params);

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM production_invoices p
            JOIN employees e ON p.emp_id = e.id
        `;
        const cParams: any[] = [];
        if (search) {
            countQuery += ` WHERE e.name LIKE ? OR e.emp_code LIKE ? OR p.invoice_no LIKE ? OR p.month_year LIKE ?`;
            const s = `%${search}%`;
            cParams.push(s, s, s, s);
        }

        const countRes = this.db.prepare(countQuery).get(...cParams) as { total: number };

        return { data, total: countRes.total };
    }

    getById(id: string) {
        const invoice = this.db.prepare(`
            SELECT p.*, e.name as emp_name, e.emp_code
            FROM production_invoices p
            JOIN employees e ON p.emp_id = e.id
            WHERE p.id = ?
        `).get(id);

        if (!invoice) return null;

        const details = this.db.prepare(`
            SELECT * FROM production_invoice_details WHERE invoice_id = ?
        `).all(id);

        return { invoice, details };
    }

    create(data: { emp_id: number; month_year: string; details: any[] }, user: string) {
        let newId = '';
        this.db.transaction(() => {
            const id = uuidv4();
            newId = id;
            const invoice_no = this.generateInvoiceNo();
            
            let gross = 0;
            let deduction = 0;

            for (const d of data.details) {
                if (d.type === 'EARNING') gross += d.amount;
                else if (d.type === 'DEDUCTION') deduction += d.amount;
            }

            const net = gross - deduction;

            this.db.prepare(`
                INSERT INTO production_invoices (id, invoice_no, emp_id, month_year, gross_amount, deduction_amount, net_amount, status, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
            `).run(id, invoice_no, data.emp_id, data.month_year, gross, deduction, net, user, user);

            const insertDetail = this.db.prepare(`
                INSERT INTO production_invoice_details (id, invoice_id, head_id, head_name, type, quantity, rate, amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const d of data.details) {
                insertDetail.run(
                    uuidv4(), id, d.head_id, d.head_name, d.type, d.quantity, d.rate, d.amount
                );
            }
        })();
        return newId;
    }

    update(id: string, data: { details: any[] }, user: string) {
        this.db.transaction(() => {
            let gross = 0;
            let deduction = 0;

            for (const d of data.details) {
                if (d.type === 'EARNING') gross += d.amount;
                else if (d.type === 'DEDUCTION') deduction += d.amount;
            }

            const net = gross - deduction;

            this.db.prepare(`
                UPDATE production_invoices 
                SET gross_amount = ?, deduction_amount = ?, net_amount = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(gross, deduction, net, user, id);

            this.db.prepare(`DELETE FROM production_invoice_details WHERE invoice_id = ?`).run(id);

            const insertDetail = this.db.prepare(`
                INSERT INTO production_invoice_details (id, invoice_id, head_id, head_name, type, quantity, rate, amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const d of data.details) {
                insertDetail.run(
                    uuidv4(), id, d.head_id, d.head_name, d.type, d.quantity, d.rate, d.amount
                );
            }
        })();
    }

    updateStatus(id: string, status: string, user: string) {
        this.db.transaction(() => {
            if (status === 'POSTED') {
                const invoice = this.db.prepare(`SELECT * FROM production_invoices WHERE id = ?`).get(id) as any;
                if (!invoice) throw new Error("Invoice not found");
                if (invoice.status === 'POSTED') throw new Error("Invoice already posted");

                const details = this.db.prepare(`SELECT * FROM production_invoice_details WHERE invoice_id = ?`).all(id);
                // First day of wage month
                const postingDate = invoice.month_year + '-01';

                this.db.prepare(`
                    UPDATE production_invoices 
                    SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run('POSTED', invoice.approved_by || user, user, id);

                // Insert into employee_monthly_wage_entries
                this.db.prepare(`
                    INSERT INTO employee_monthly_wage_entries 
                    (emp_id, posting_date, source_type, source_id, gross_amount, deduction_amount, net_amount, details, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    invoice.emp_id, 
                    postingDate, 
                    'PRODUCTION_ENTRY', 
                    invoice.id, 
                    invoice.gross_amount, 
                    invoice.deduction_amount, 
                    invoice.net_amount, 
                    JSON.stringify(details),
                    user
                );

                this.db.prepare(`
                    INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    uuidv4(),
                    user,
                    'POST_PAYROLL',
                    'production_invoices',
                    invoice.id,
                    JSON.stringify({
                       message: 'Posted to payroll via employee_monthly_wage_entries',
                       gross: invoice.gross_amount,
                       net: invoice.net_amount 
                    })
                );
            } else if (status === 'APPROVED') {
                this.db.prepare(`
                    UPDATE production_invoices 
                    SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(status, user, user, id);
            } else {
                this.db.prepare(`
                    UPDATE production_invoices 
                    SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(status, user, id);
            }
        })();
    }

    delete(id: string, user: string) {
        this.db.transaction(() => {
            try {
                this.db.prepare(`UPDATE production_invoices SET updated_by = ? WHERE id = ? AND status = 'DRAFT'`).run(user, id);
            } catch (e) {}
            this.db.prepare(`DELETE FROM production_invoices WHERE id = ? AND status = 'DRAFT'`).run(id);
        })();
    }
}
