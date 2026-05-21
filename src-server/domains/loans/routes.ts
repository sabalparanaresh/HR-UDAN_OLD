import express from 'express';

export const loansRouter = express.Router();

loansRouter.get('/applications', (req: any, res) => {
    try {
        const apps = req.primaryDb.prepare(`
            SELECT a.*, e.first_name || ' ' || e.last_name as employee_name, e.emp_code, t.name as loan_type_name,
            (SELECT SUM(actual_paid_amount) FROM loan_amortisation WHERE loan_app_id = a.id  AND status = 'PAID') as paid_amount,
            (SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = a.id  AND status = 'DUE') as pending_amount
            FROM loan_applications a
            JOIN employees e ON a.emp_id = e.id
            JOIN loan_types t ON a.loan_type_id = t.id
        `).all();
        res.json(apps);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/eligibility', (req: any, res) => {
    try {
        const { empId, loanTypeId } = req.query;
        const e = req.primaryDb.prepare('SELECT category_id, class_id, joining_date, wage_amount FROM employees WHERE id = ?').get(empId) as any;
        const config = req.primaryDb.prepare('SELECT * FROM loan_types WHERE id = ?').get(loanTypeId) as any;
        if (!config) return res.json({ eligible: false, reason: 'Invalid loan type' });
      
        let max_amount = 0;
        let max_tenure = 0;
        try {
          const slabs = config.slabs ? JSON.parse(config.slabs) : [];
          for (const slab of slabs) {
            if (slab.allowed_amount > max_amount) max_amount = slab.allowed_amount;
            if (slab.max_tenure > max_tenure) max_tenure = slab.max_tenure;
          }
        } catch(e) {}
      
        res.json({ 
            eligible: true, 
            reason: '', 
            max_amount: max_amount > 0 ? max_amount : undefined, 
            max_tenure: max_tenure > 0 ? max_tenure : undefined,
            flexibility_in_policy: config.flexibility_in_policy === 1
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/active', (req: any, res) => {
    try {
        const { empId, guarantorId } = req.query;
        const activeLoanQuery = `
          SELECT 
            la.id, la.status, la.application_date, la.reason, la.emi_amount,
            e.first_name || ' ' || e.last_name as applicant_name, t.name as loan_type_name,
            (SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = la.id  AND status = 'DUE') as pending_amount,
            (SELECT MAX(month_year) FROM loan_amortisation WHERE loan_app_id = la.id) as closing_month
          FROM loan_applications la
          JOIN employees e ON la.emp_id = e.id
          JOIN loan_types t ON la.loan_type_id = t.id
          WHERE (la.emp_id = ? OR la.guarantor_id = ?) AND la.status NOT IN ('CLOSED', 'REJECTED')
        `;
        const activeLoans = req.primaryDb.prepare(activeLoanQuery).all(empId, guarantorId || -1);
        res.json({ hasActiveLoan: activeLoans.length > 0, activeLoans });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/applications', (req: any, res) => {
    try {
        const { application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks } = req.body;
        const result = req.primaryDb.prepare(`
          INSERT INTO loan_applications (application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).run(application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id || null, reason, remarks);
        res.json({ status: 'success', id: result.lastInsertRowid });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.put('/applications/:id/override', (req: any, res) => {
    try {
        const { loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode } = req.body;
        req.primaryDb.prepare(`UPDATE loan_applications SET loan_amount = ?, no_of_emi = ?, emi_amount = ?, start_month_year = ?, payment_mode = ? WHERE id = ?`)
          .run(loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, req.params.id);
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.put('/applications/:id/status', (req: any, res) => {
    try {
        const { status, remark } = req.body;
        if (remark) {
            req.primaryDb.prepare('UPDATE loan_applications SET status = ?, remarks = ? WHERE id = ?').run(status, remark, req.params.id);
        } else {
            req.primaryDb.prepare('UPDATE loan_applications SET status = ? WHERE id = ?').run(status, req.params.id);
        }
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/applications/:id/amortisation/generate', (req: any, res) => {
    try {
        const loanId = req.params.id;
        const app = req.primaryDb.prepare('SELECT * FROM loan_applications WHERE id = ?').get(loanId) as any;
        if (!app) return res.status(404).json({ status: 'error', reason: 'Not found' });
        
        req.primaryDb.prepare('DELETE FROM loan_amortisation WHERE loan_app_id = ?').run(loanId);
        
        let currentMonthYear = app.start_month_year;
        for (let i = 1; i <= app.no_of_emi; i++) {
           req.primaryDb.prepare(`
              INSERT INTO loan_amortisation (loan_app_id, emi_no, month_year, planned_amount, actual_paid_amount, status)
              VALUES (?, ?, ?, ?, ?, 'DUE')
           `).run(loanId, i, currentMonthYear, app.emi_amount, 0);
      
           let [year, month] = currentMonthYear.split('-');
           let y = parseInt(year);
           let m = parseInt(month) + 1;
           if (m > 12) { m = 1; y += 1; }
           currentMonthYear = `${y}-${m.toString().padStart(2, '0')}`;
        }
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/applications/:id/amortisation', (req: any, res) => {
    try {
        const amort = req.primaryDb.prepare('SELECT * FROM loan_amortisation WHERE loan_app_id = ? ORDER BY emi_no').all(req.params.id);
        res.json(amort);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.put('/amortisation/:id/dynamic-update', (req: any, res) => {
    try {
        const { action, newAmount, paymentMode, remarks, authorisedBy } = req.body;
        const emi = req.primaryDb.prepare('SELECT * FROM loan_amortisation WHERE id = ?').get(req.params.id) as any;
        if (!emi) return res.status(404).json({error: 'Not found'}); 
        
        if (action === 'PREPAYMENT') {
           req.primaryDb.prepare('UPDATE loan_amortisation SET actual_paid_amount = ?, payment_type = ?, status = ?, remarks = ? WHERE id = ?')
             .run(newAmount, paymentMode, 'PAID', remarks, req.params.id);
        } else if (action === 'EDIT_AMOUNT') {
           req.primaryDb.prepare('UPDATE loan_amortisation SET planned_amount = ?, remarks = ?, authorised_by = ? WHERE id = ?')
             .run(newAmount, remarks, authorisedBy, req.params.id);
        } else if (action === 'SKIP') {
           req.primaryDb.prepare('UPDATE loan_amortisation SET status = ?, remarks = ?, authorised_by = ? WHERE id = ?')
             .run('SKIPPED', remarks, authorisedBy, req.params.id);
             
           const lastEmi = req.primaryDb.prepare('SELECT emi_no, month_year FROM loan_amortisation WHERE loan_app_id = ? ORDER BY emi_no DESC LIMIT 1').get(emi.loan_app_id) as any;
           let [year, month] = lastEmi.month_year.split('-');
           let y = parseInt(year);
           let m = parseInt(month) + 1;
           if (m > 12) { m = 1; y += 1; }
           const nextMonthYear = `${y}-${m.toString().padStart(2, '0')}`;
      
           req.primaryDb.prepare(`
              INSERT INTO loan_amortisation (loan_app_id, emi_no, month_year, planned_amount, actual_paid_amount, status)
              VALUES (?, ?, ?, ?, ?, 'DUE')
           `).run(emi.loan_app_id, lastEmi.emi_no + 1, nextMonthYear, emi.planned_amount, 0);
        }
        
        const totalPending = req.primaryDb.prepare('SELECT COUNT(*) as c FROM loan_amortisation WHERE loan_app_id = ? AND status = ?').get(emi.loan_app_id, 'DUE') as any;
        if (totalPending.c === 0) {
           req.primaryDb.prepare('UPDATE loan_applications SET status = ? WHERE id = ?').run('CLOSED', emi.loan_app_id);
        }
        
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/reports', (req: any, res) => {
    try {
        const moduleType = req.headers['x-module-type'] || 'K';
        const db = moduleType === 'P' ? req.statutoryDb : req.primaryDb;
        
        const sql = `
          SELECT 
            a.id,
            a.emp_id as employee_id,
            COALESCE(NULLIF(e.first_name || ' ' || e.last_name, ' '), e.name) as employee_name,
            e.emp_code,
            a.loan_type_id,
            t.name as loan_type_name,
            a.loan_amount as amount,
            a.no_of_emi as tenure_months,
            a.reason,
            a.status,
            0 as grace_period_months,
            a.start_month_year as repayment_start_date,
            a.application_date as created_at,
            COALESCE((SELECT SUM(actual_paid_amount) FROM loan_amortisation WHERE loan_app_id = a.id AND status = 'PAID'), 0) as paid_amount,
            COALESCE((SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = a.id AND status = 'DUE'), 0) as pending_amount
          FROM loan_applications a
          JOIN employees e ON a.emp_id = e.id
          JOIN loan_types t ON a.loan_type_id = t.id
        `;
        const reports = db.prepare(sql).all();
        res.json(reports);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
