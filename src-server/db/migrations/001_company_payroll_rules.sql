CREATE TABLE IF NOT EXISTS company_payroll_rules (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    k_salary_calculation_source TEXT DEFAULT 'EMPLOYEE_MASTER',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO company_payroll_rules (id, k_salary_calculation_source) VALUES (1, 'EMPLOYEE_MASTER');
