import express from 'express';

export const bankingRouter = express.Router();

bankingRouter.get('/configs', (req: any, res) => {
    try {
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;
        const rows = db.prepare('SELECT * FROM bank_excel_configs').all();
        res.json(rows.map((r: any) => ({ ...r, columns: JSON.parse(r.columns_json) })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

bankingRouter.post('/configs', (req: any, res) => {
    try {
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;
        const { id, bank_name, columns } = req.body;
        const columns_json = JSON.stringify(columns);
        if (id) {
            db.prepare('UPDATE bank_excel_configs SET bank_name = ?, columns_json = ? WHERE id = ?').run(bank_name, columns_json, id);
        } else {
            db.prepare('INSERT INTO bank_excel_configs (bank_name, columns_json) VALUES (?, ?)').run(bank_name, columns_json);
        }
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

bankingRouter.delete('/configs/:id', (req: any, res) => {
    try {
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;
        db.prepare('DELETE FROM bank_excel_configs WHERE id = ?').run(req.params.id);
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

bankingRouter.post('/reserve-references', (req: any, res) => {
    try {
        const { bankName, count, startNo } = req.body;
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;

        const begin = db.prepare('BEGIN IMMEDIATE');
        const commit = db.prepare('COMMIT');
        const rollback = db.prepare('ROLLBACK');

        try {
            begin.run();
            const existing = db.prepare('SELECT last_reference_number FROM bank_transfer_references WHERE bank_name = ?').get(bankName) as any;
            let currentRef = existing ? existing.last_reference_number : (startNo || 1);

            const generatedRefs: string[] = [];
            for (let i = 0; i < count; i++) {
                generatedRefs.push(currentRef.toString());
                currentRef++;
            }

            if (existing) {
                db.prepare('UPDATE bank_transfer_references SET last_reference_number = ?, updated_at = CURRENT_TIMESTAMP WHERE bank_name = ?').run(currentRef, bankName);
            } else {
                db.prepare('INSERT INTO bank_transfer_references (bank_name, last_reference_number) VALUES (?, ?)').run(bankName, currentRef);
            }

            commit.run();
            res.json(generatedRefs);
        } catch (err: any) {
            rollback.run();
            throw err;
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

bankingRouter.post('/generate-excel', (req: any, res) => {
    // This generates the bank excel equivalent logic
    // Currently returns a dummy response reflecting the old command
    res.json({ status: 'success', message: 'Excel generation initiated' });
});

bankingRouter.get('/processed-salary', (req: any, res) => {
    try {
        const { month } = req.query;
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;
        
        const rows = db.prepare(`
            SELECT 
              fp.*, 
              fp.name as first_name, 
              '' as last_name,
              fp.net_payable_final as net_salary,
              fp.ifsc as ifsc_code,
              e.as_per_bank_name,
              e.phone,
              e.email
            FROM final_payroll fp
            LEFT JOIN employees e ON fp.emp_code = e.emp_code
            WHERE fp.month_year = ?
        `).all(month);
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
