import { CommandHandler } from './types.js';

export const getLoanApplications: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const apps = primaryDb.prepare(`
    SELECT a.*, e.first_name || ' ' || e.last_name as employee_name, e.emp_code, t.name as loan_type_name,
    (SELECT SUM(actual_paid_amount) FROM loan_amortisation WHERE loan_app_id = a.id  AND status = 'PAID') as paid_amount,
    (SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = a.id  AND status = 'DUE') as pending_amount
    FROM loan_applications a
    JOIN employees e ON a.emp_id = e.id
    JOIN loan_types t ON a.loan_type_id = t.id
  `).all();
  res.json(apps);
};

export const calculateLoanEligibility: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { empId, loanTypeId } = args;
  const e = primaryDb.prepare('SELECT category_id, class_id, joining_date, wage_amount FROM employees WHERE id = ?').get(empId) as any;
  const config = primaryDb.prepare('SELECT * FROM loan_types WHERE id = ?').get(loanTypeId) as any;
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
};

export const checkActiveLoans: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { empId, guarantorId } = args;
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
  const activeLoans = primaryDb.prepare(activeLoanQuery).all(empId, guarantorId || -1);
  res.json({ hasActiveLoan: activeLoans.length > 0, activeLoans });
};

export const createLoanApplication: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks } = args;
  const result = primaryDb.prepare(`
    INSERT INTO loan_applications (application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id || null, reason, remarks);
  res.json({ status: 'success', id: result.lastInsertRowid });
};

export const overrideAndApproveLoan: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { loanId, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode } = args;
  primaryDb.prepare(`UPDATE loan_applications SET loan_amount = ?, no_of_emi = ?, emi_amount = ?, start_month_year = ?, payment_mode = ? WHERE id = ?`)
    .run(loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, loanId);
  res.json({ status: 'success' });
};

export const updateLoanStatus: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { loanId, status, remark } = args;
  if (remark) primaryDb.prepare('UPDATE loan_applications SET status = ?, remarks = ? WHERE id = ?').run(status, remark, loanId);
  else primaryDb.prepare('UPDATE loan_applications SET status = ? WHERE id = ?').run(status, loanId);
  res.json({ status: 'success' });
};

export const generateAmortisationSchedule: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { loanId } = args;
  const app = primaryDb.prepare('SELECT * FROM loan_applications WHERE id = ?').get(loanId) as any;
  if (!app) return res.json({ status: 'error', reason: 'Not found' });
  
  let currentMonthYear = app.start_month_year;
  for (let i = 1; i <= app.no_of_emi; i++) {
     primaryDb.prepare(`\
        INSERT INTO loan_amortisation (loan_app_id, emi_no, month_year, planned_amount, actual_paid_amount, status(\
        VALUES (?, ?, ?, ?, ?, 'DUE')\
     `).run(loanId, i, currentMonthYear, app.emi_amount, 0);

     let [year, month] = currentMonthYear.split('-');
     let y = parseInt(year);
     let m = parseInt(month) + 1;
     if (m > 12) { m = 1; y += 1; }
     currentMonthYear = `${y}-${m.toString().padStart(2, '0')}`;
  }
  res.json({ status: 'success' });
};

export const getLoanAmortization: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { loanId } = args;
  const amort = primaryDb.prepare('SELECT * FROM loan_amortisation WHERE loan_app_id = ? ORDER BY emi_no').all(loanId);
  res.json(amort);
};

export const updateEmiDynamic: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { amortizationId, action, newAmount, paymentMode, remarks, authorisedBy } = args;
  const emi = primaryDb.prepare('SELECT * FROM loan_amortisation WHERE id = ?').get(amortizationId) as any;
  if (!emi)  return res.status(404).json({error: 'Not found'}); 
  
  if (action === 'PREPAYMENT') {
     primaryDb.prepare('UPDATE loan_amortisation SET actual_paid_amount = ?, payment_type = ?, status = ?, remarks = ? WHERE id = ?')
       .run(newAmount, paymentMode, 'PAID', remarks, amortizationId);
  } else if (action === 'EDIT_AMOUNT') {
     primaryDb.prepare('UPDATE loan_amortisation SET planned_amount = ?, remarks = ?, authorised_by = ? WHERE id = ?')
       .run(newAmount, remarks, authorisedBy, amortizationId);
  } else if (action === 'SKIP') {
     primaryDb.prepare('UPDATE loan_amortisation SET status = ?, remarks = ?, authorised_by = ? WHERE id = ?')
       .run('SKIPPED', remarks, authorisedBy, amortizationId);
       
     const lastEmi = primaryDb.prepare('SELECT emi_no, month_year FROM loan_amortisation WHERE loan_app_id = ? ORDER BY emi_no DESC LIMIT 1').get(emi.loan_app_id) as any;
     let [year, month] = lastEmi.month_year.split('-');
     let y = parseInt(year);
     let m = parseInt(month) + 1;
     if (m > 12) { m = 1; y += 1; }
     const nextMonthYear = `${y}-${m.toString().padStart(2, '0')}`;

     primaryDb.prepare(`\
        INSERT INTO loan_amortisation (loan_app_id, emi_no, month_year, planned_amount, actual_paid_amount, status)\
        VALUES (?, ?, ?, ?, ?, 'DUE')\
     `).run(emi.loan_app_id, lastEmi.emi_no + 1, nextMonthYear, emi.planned_amount, 0);
  }
  
  const totalPending = primaryDb.prepare('SELECT COUNT(*) as c FROM loan_amortisation WHERE loan_app_id = ? AND status = ?').get(emi.loan_app_id, 'DUE') as any;
  if (totalPending.c === 0) {
     primaryDb.prepare('UPDATE loan_applications SET status = ? WHERE id = ?').run('CLOSED', emi.loan_app_id);
  }
  
  res.json({ status: 'success' });
};
