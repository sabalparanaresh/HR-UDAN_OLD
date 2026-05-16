import { CommandHandler } from './types.js';

export const getLoanApplications: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const apps = primaryDb.prepare(`
            SELECT a.*, e.name as employee_name, e.emp_code, t.name as loan_type_name,
            (SELECT SUM(actual_paid_amount) FROM loan_amortisation WHERE loan_app_id = a.id AND status = 'PAID') as paid_amount,
            (SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = a.id AND status = 'DUE') as pending_amount
            FROM loan_applications a
            JOIN employees e ON a.emp_id = e.id
            JOIN loan_types t ON a.loan_type_id = t.id
          `).all();
          res.json(apps);
          
};

export const calculateLoanEligibility: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { empId, loanTypeId, applicationDate } = args;
          const e = primaryDb.prepare('SELECT category_id, class_id, joining_date, wage_amount FROM employees WHERE id = ?').get(empId) as any;
          const config = primaryDb.prepare('SELECT * FROM loan_types WHERE id = ?').get(loanTypeId) as any;
          
          if (!config) {
            res.json({ eligible: false, reason: 'Invalid loan type' });
            
}
};

export const checkActiveLoans: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { empId, guarantorId } = args;
          const activeLoanQuery = `
            SELECT 
              la.id, 
              la.status,
              la.application_date,
              la.reason,
              la.emi_amount,
              e.name as applicant_name,
              t.name as loan_type_name,
              (SELECT SUM(planned_amount) FROM loan_amortisation WHERE loan_app_id = la.id AND status = 'DUE') as pending_amount,
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
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks } = args;
          const result = primaryDb.prepare(`
            INSERT INTO loan_applications (application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id, reason, remarks, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
          `).run(application_date, emp_id, loan_type_id, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, guarantor_id || null, reason, remarks);
          res.json({ status: 'success', id: result.lastInsertRowid });
          
};

export const overrideAndApproveLoan: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { loanId, loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode } = args;
          primaryDb.prepare(`
             UPDATE loan_applications 
             SET loan_amount = ?, no_of_emi = ?, emi_amount = ?, start_month_year = ?, payment_mode = ?
             WHERE id = ?
          `).run(loan_amount, no_of_emi, emi_amount, start_month_year, payment_mode, loanId);
          res.json({ status: 'success' });
          
};

export const updateLoanStatus: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { loanId, status, remark } = args;
          if (remark) {
            primaryDb.prepare('UPDATE loan_applications SET status = ?, remarks = ? WHERE id = ?').run(status, remark, loanId);
          } else {
            primaryDb.prepare('UPDATE loan_applications SET status = ? WHERE id = ?').run(status, loanId);
          }
          res.json({ status: 'success' });
          
};

export const generateAmortisationSchedule: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { loanId } = args;
          const app = primaryDb.prepare('SELECT * FROM loan_applications WHERE id = ?').get(loanId) as any;
          if (!app) {
             res.json({ status: 'error', reason: 'Not found' });
             
}
};

export const getLoanAmortization: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { loanId } = args;
          const amort = primaryDb.prepare('SELECT * FROM loan_amortisation WHERE loan_app_id = ? ORDER BY emi_no').all(loanId);
          res.json(amort);
          
};

export const updateEmiDynamic: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { amortizationId, action, newAmount, paymentMode, remarks, authorisedBy } = args;
          // action can be 'SKIP', 'EDIT_AMOUNT', 'PREPAYMENT'
          const emi = primaryDb.prepare('SELECT * FROM loan_amortisation WHERE id = ?').get(amortizationId) as any;
          if (!emi) { res.status(404).json({error: 'Not found'}); 
}
};
