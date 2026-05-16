import { PayrollEngineK } from '../services/PayrollEngineK.js';
let isSystemProcessing = false;
import { CommandHandler } from './types.js';
import { logError } from '../utils/logger.js';
import { PayrollEngine } from '../services/PayrollEngine.js';
import { calculateBifurcation } from '../utils/helpers.js';

export const calculatePayrollDraft: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { month, moduleType, filters } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  let sql = `
    SELECT 
      e.*, 
      d.name as department_name, 
      des.name as designation_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    WHERE e.status = 1
  `;
  const params: any[] = [];
  if (filters) {
    const filterMapping = [
      { key: 'departmentId', column: 'e.department_id' },
      { key: 'locationId', column: 'e.location_id' },
      { key: 'divisionId', column: 'e.division_id' },
      { key: 'classId', column: 'e.class_id' },
      { key: 'categoryId', column: 'e.category_id' },
      { key: 'groupId', column: 'e.group_id' },
      { key: 'designationId', column: 'e.designation_id' },
    ];

    filterMapping.forEach(({ key, column }) => {
      const val = filters[key];
      if (val) {
        if (Array.isArray(val) && val.length > 0) {
          const placeholders = val.map(() => '?').join(',');
          sql += ` AND ${column} IN (${placeholders})`;
          params.push(...val);
        } else if (!Array.isArray(val)) {
          sql += ` AND ${column} = ?`;
          params.push(val);
        }
      }
    });
  }

  const employees = db.prepare(sql).all(...params) as any[];
  if (employees.length === 0) return res.json([]);

  const empIds = employees.map(e => e.id);
  const placeholders = empIds.map(() => '?').join(',');

  // BULK FETCHES to solve N+1 (Audit 3.3)
  const attendanceLogs = db.prepare(`
    SELECT emp_id, SUM(attendance_value) as total 
    FROM attendance_logs 
    WHERE date LIKE ? AND emp_id IN (${placeholders})
    GROUP BY emp_id
  `).all(`${month}%`, ...empIds) as any[];
  const attendanceMap = new Map(attendanceLogs.map(l => [l.emp_id, l.total]));

  const salaryTransactions = db.prepare(`
    SELECT st.emp_id, st.transaction_type, sh.name, st.amount 
    FROM salary_transactions st
    JOIN salary_heads sh ON st.head_id = sh.id
    WHERE st.salary_month_year = ? AND st.emp_id IN (${placeholders})
  `).all(month, ...empIds) as any[];
  
  const transactionsMap = new Map<number, any[]>();
  salaryTransactions.forEach(st => {
    if (!transactionsMap.has(st.emp_id)) transactionsMap.set(st.emp_id, []);
    transactionsMap.get(st.emp_id)!.push(st);
  });

  const leaveBalances = db.prepare(`
    SELECT emp_id, leave_config_id, balance 
    FROM leave_balances 
    WHERE emp_id IN (${placeholders})
  `).all(...empIds) as any[];
  const leaveMap = new Map<number, any[]>();
  leaveBalances.forEach(lb => {
    if (!leaveMap.has(lb.emp_id)) leaveMap.set(lb.emp_id, []);
    leaveMap.get(lb.emp_id)!.push(lb);
  });

  const canteenDeductions = db.prepare(`
    SELECT emp_id, total_deduction 
    FROM canteen_deductions_cache 
    WHERE month = ? AND emp_id IN (${placeholders})
  `).all(month, ...empIds) as any[];
  const canteenMap = new Map(canteenDeductions.map(c => [c.emp_id, c.total_deduction]));

  const salaryLocks = db.prepare(`
    SELECT emp_id, is_locked, snapshot_config 
    FROM salary_locks 
    WHERE month = ? AND module_type = ? AND emp_id IN (${placeholders})
  `).all(month, moduleType, ...empIds) as any[];
  const locksMap = new Map(salaryLocks.map(l => [l.emp_id, l]));

  const leaveConfigs = db.prepare('SELECT * FROM leave_configurations WHERE status = 1 ORDER BY adjustment_priority ASC').all() as any[];
  const salaryHeads = db.prepare('SELECT id, name, type FROM salary_heads').all() as any[];

  // Settings
  const pfSettingsRow = db.prepare("SELECT config FROM statutory_settings WHERE type = 'PF' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const esiSettingsRow = db.prepare("SELECT config FROM statutory_settings WHERE type = 'ESI' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const ptSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'PTAX' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const lwfSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'LWF' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  
  let pfConfig = { ceiling_amount: 15000, employee_pct: 12, gross_heads: [] as number[] };
  let esiConfig = { eligibility_limit: 21000, employee_pct: 0.75, gross_heads: [] as number[] };
  let ptConfig: any = null;
  let lwfConfig: any = null;

  if (pfSettingsRow?.config) {
    try { pfConfig = { ...pfConfig, ...(typeof pfSettingsRow.config === 'string' ? JSON.parse(pfSettingsRow.config) : pfSettingsRow.config) }; } catch (e) {}
  }
  if (esiSettingsRow?.config) {
    try { esiConfig = { ...esiConfig, ...(typeof esiSettingsRow.config === 'string' ? JSON.parse(esiSettingsRow.config) : esiSettingsRow.config) }; } catch (e) {}
  }
  if (ptSettingsRow?.config) {
    try { ptConfig = typeof ptSettingsRow.config === 'string' ? JSON.parse(ptSettingsRow.config) : ptSettingsRow.config; } catch (e) {}
  }
  if (lwfSettingsRow?.config) {
    try { lwfConfig = typeof lwfSettingsRow.config === 'string' ? JSON.parse(lwfSettingsRow.config) : lwfSettingsRow.config; } catch (e) {}
  }

  let statutoryUniformConfig: any = null;
  if (moduleType === 'P') {
    statutoryUniformConfig = db.prepare('SELECT * FROM working_day_types WHERE is_statutory_uniform = 1 LIMIT 1').get() as any;
    if (!statutoryUniformConfig) {
      statutoryUniformConfig = db.prepare('SELECT * FROM working_day_types WHERE status = 1 LIMIT 1').get() as any;
    }
  }

  // Pre-fetch working day types for module K to avoid inner loop query
  const workingDayTypesMap = new Map();
  if (moduleType === 'K') {
    const wdts = db.prepare('SELECT * FROM working_day_types').all() as any[];
    wdts.forEach(w => workingDayTypesMap.set(w.id, w));
  }

  const preview = employees.map(emp => {
    const presentDays = attendanceMap.get(emp.id) || 0;
    
    let divisor = 30;
    let workingDayConfig = 'DEFAULT (30)';
    
    let wdt = moduleType === 'P' ? statutoryUniformConfig : null;
    if (moduleType === 'K' && emp.working_day_type_id) {
      wdt = workingDayTypesMap.get(emp.working_day_type_id);
    }

    if (wdt) {
      const wdResult = PayrollEngine.getWorkingDays(wdt, month);
      divisor = wdResult.divisor;
      workingDayConfig = wdResult.configStr + (moduleType === 'P' ? ' [UNIFORM]' : '');
    }

    let absence = divisor - presentDays;
    let adjusted_leave = 0;

    if (absence > 0) {
      const empLeaves = leaveMap.get(emp.id) || [];
      for (const config of leaveConfigs) {
        const lb = empLeaves.find(l => l.leave_config_id === config.id);
        const bal = lb?.balance || 0;
        if (bal > 0) {
          const adjust = Math.min(bal, absence);
          absence -= adjust;
          adjusted_leave += adjust;
          if (absence <= 0) break;
        }
      }
    }

    const finalAtt = presentDays + adjusted_leave;
    
    // Fetch historical rate for this month
    const rate = PayrollEngine.getEffectiveRate(db, emp.id, month, moduleType as 'K' | 'P');
    
    let draftGross = 0;
    if (emp.wage_type === 'Daily') {
      draftGross = rate * finalAtt;
    } else {
      draftGross = (rate / divisor) * finalAtt;
    }
    
    const empTransactions = transactionsMap.get(emp.id) || [];
    const earnings: Record<string, number> = {};
    let totalVarEarning = 0;
    const deductions: Record<string, number> = {};
    let totalVarDeduction = 0;

    empTransactions.forEach(st => {
      if (st.transaction_type === 'EARNING') {
        earnings[st.name] = (earnings[st.name] || 0) + st.amount;
        totalVarEarning += st.amount;
      } else {
        deductions[st.name] = (deductions[st.name] || 0) + st.amount;
        totalVarDeduction += st.amount;
      }
    });

    const grossPayable = draftGross + totalVarEarning;

    const statutoryDeds = PayrollEngine.calculateStatutoryDeductions(
      emp,
      draftGross,
      earnings,
      salaryHeads,
      { pf: pfConfig, esi: esiConfig, pt: ptConfig, lwf: lwfConfig },
      month
    );

    // Apply mapped dynamic heads
    for (const [headName, amount] of Object.entries(statutoryDeds.breakdown)) {
      deductions[headName] = amount;
    }

    const canteenDeduction = canteenMap.get(emp.id) || 0;
    if (canteenDeduction > 0) deductions['Canteen'] = canteenDeduction;

    const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
    const netPayable = grossPayable - totalDeductions;

    const statutoryGross = (emp.basic_salary || 0) + (emp.hra || 0) + (emp.conveyance || 0);
    const adjustedDiff = draftGross - statutoryGross;
    
    const empLeaves = leaveMap.get(emp.id) || [];
    const totalBal = empLeaves.reduce((acc, curr) => acc + curr.balance, 0);
    const lockInfo = locksMap.get(emp.id);

    return {
      emp_id: emp.id,
      emp_code: emp.emp_code,
      name: emp.name,
      department_name: emp.department_name || 'N/A',
      designation_name: emp.designation_name || 'N/A',
      type_name: moduleType,
      actual_attendance: finalAtt,
      statutory_attendance: finalAtt,
      actual_earning: draftGross, 
      wage_type: emp.wage_type,
      wage_amount: rate,
      working_day_config: lockInfo ? lockInfo.snapshot_config : workingDayConfig,
      divisor,
      earnings,
      deductions,
      gross_payable: grossPayable,
      net_payable: netPayable,
      pf: statutoryDeds.PF,
      esi: statutoryDeds.ESI,
      pt: statutoryDeds.PT,
      lwf: statutoryDeds.LWF,
      loan_emi: 0,
      canteen_deduction: canteenDeduction,
      diff: netPayable,
      blacklist_status: emp.blacklist_status === 1,
      adjusted_leave,
      balance_leave: totalBal,
      is_locked: lockInfo ? lockInfo.is_locked === 1 : false,
      source_of_truth: 'Live Logs',
      status: 'Draft',
      statutory_gross: statutoryGross,
      adjusted_diff: adjustedDiff
    };
  });

  res.json(preview);
};

export const salaryProcessingCache = new Map<string, any[]>();

export const getPaginatedSalaryResults: CommandHandler = (ctx, args) => {
  const { res } = ctx;
  const { month, type, page = 1, limit = 50, search = '' } = args;
  const data = salaryProcessingCache.get(`${month}-${type}`) || [];
  let filtered = data;
  if (search) {
    const s = search.toLowerCase().trim();
    const scored = data.map((d: any) => {
      const code = String(d.emp_code || '').toLowerCase();
      const name = String(d.name || '').toLowerCase();
      
      let score = -1;
      if (code === s) score = 3;
      else if (code.startsWith(s)) score = 2;
      else if (name.split(' ').some(part => part.startsWith(s))) score = 1;
      else if (
        code.includes(s) || 
        name.includes(s) || 
        String(d.department || '').toLowerCase().includes(s) ||
        String(d.designation || '').toLowerCase().includes(s) ||
        String(d.category || '').toLowerCase().includes(s)
      ) {
        score = 0;
      }
      return { item: d, score };
    }).filter(x => x.score >= 0);

    filtered = scored
      .sort((a, b) => b.score - a.score || String(a.item.emp_code).localeCompare(String(b.item.emp_code)))
      .map(x => x.item);
  }
  const offset = (page - 1) * limit;
  const paginated = limit === -1 ? filtered : filtered.slice(offset, offset + limit);
  const parsedPaginated = paginated.map(row => {
    const parsed: any = { ...row };
    const jsonCols = ['k_other_earnings', 'k_deductions', 'p_other_earnings_kp', 'p_deductions', 'head_wise_rates', 'p_ctc_heads'];
    jsonCols.forEach(col => {
      if (row[col] && typeof row[col] === 'string') {
        try {
          parsed[col] = JSON.parse(row[col]);
        } catch(e) {}
      }
    });
    return parsed;
  });
  res.json({ data: parsedPaginated, total: filtered.length });
};

export const getPayrollExceptions: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { month } = args;
  
  const sql = `
    SELECT pe.*, e.name as employee_name, e.emp_code 
    FROM payroll_exceptions pe
    JOIN employees e ON pe.employee_id = e.id
    ${month ? 'WHERE pe.salary_month = ?' : ''}
    ORDER BY created_at DESC
  `;
  
  const data = month ? primaryDb.prepare(sql).all(month) : primaryDb.prepare(sql).all();
  res.json(data);
};

export const calculateKModuleWages: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { month, filters } = args;

  const startTime = Date.now();

  try {
    primaryDb.prepare('DELETE FROM payroll_exceptions WHERE salary_month = ?').run(month);
  } catch(e) {}

  const minWageRow = statutoryDb.prepare("SELECT config, effective_date FROM statutory_settings WHERE type = 'MIN_WAGE' ORDER BY effective_date DESC LIMIT 1").get() as any;
  let hasValidMinWage = false;
  if (minWageRow && minWageRow.config) {
    try {
      const config = typeof minWageRow.config === 'string' ? JSON.parse(minWageRow.config) : minWageRow.config;
      if (config.wages && config.wages.length > 0) {
         hasValidMinWage = true;
         const [pYear, pMonth] = month.split('-').map(Number);
         const processVal = pYear * 12 + pMonth;

         if (config.end_date) {
            const [eYear, eMonth] = config.end_date.split('-').map(Number);
            const endVal = eYear * 12 + eMonth;
            if (processVal > endVal) hasValidMinWage = false;
         } else {
            hasValidMinWage = true; // No end date means valid
         }
      }
    } catch (e) { }
  }

  if (!hasValidMinWage) {
    return res.status(400).json({ error: "System check failed: Minimum wages are not configured or are expired for this period. Please configure them in Statutory Settings with 'From' and 'To' dates." });
  }

  const companyConfig = primaryDb.prepare('SELECT payroll_adjustment_head FROM company_config WHERE id = 1').get() as any;
  if (!companyConfig || !companyConfig.payroll_adjustment_head) {
    return res.status(400).json({ error: "Payroll Adjustment head is not defined in Company Setting->Payroll Rule" });
  }

  // 1. Fetch Company Payroll Rule
  const payrollRuleRow = primaryDb.prepare('SELECT k_salary_calculation_source FROM company_payroll_rules WHERE id = 1').get() as any;
  const kEngineSource = payrollRuleRow?.k_salary_calculation_source || 'EMPLOYEE_MASTER';

  let sql = `
    SELECT e.*, d.name as department_name, des.name as designation_name,
           c.name as category_name, cl.name as class_name,
           loc.name as location_name, div.name as division_name,
           g.name as group_name, rep.name as reporting_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN designations des ON e.designation_id = des.id
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN classes cl ON e.class_id = cl.id
    LEFT JOIN locations loc ON e.location_id = loc.id
    LEFT JOIN divisions div ON e.division_id = div.id
    LEFT JOIN groups g ON e.group_id = g.id
    LEFT JOIN employees rep ON e.reporting_employee_id = rep.id
    WHERE e.status = 1
  `;
  const params: any[] = [];
  if (filters) {
    const filterMapping = [
      { key: 'departmentId', column: 'e.department_id' },
      { key: 'locationId', column: 'e.location_id' },
      { key: 'divisionId', column: 'e.division_id' },
      { key: 'classId', column: 'e.class_id' },
      { key: 'categoryId', column: 'e.category_id' },
      { key: 'groupId', column: 'e.group_id' },
      { key: 'designationId', column: 'e.designation_id' },
    ];

    filterMapping.forEach(({ key, column }) => {
      const val = filters[key];
      if (val) {
        if (Array.isArray(val) && val.length > 0) {
          const placeholders = val.map(() => '?').join(',');
          sql += ` AND ${column} IN (${placeholders})`;
          params.push(...val);
        } else if (!Array.isArray(val)) {
          sql += ` AND ${column} = ?`;
          params.push(val);
        }
      }
    });
  }

  const employees = primaryDb.prepare(sql).all(...params) as any[];
  if (employees.length === 0) return res.json([]);
  
  const empIds = employees.map(e => e.id);
  const placeholders = empIds.map(() => '?').join(',');

  const leaveConfigs = primaryDb.prepare('SELECT * FROM leave_configurations WHERE status = 1 ORDER BY adjustment_priority ASC').all() as any[];

  // 1. Bulk Attendance
  const attendanceLogs = primaryDb.prepare(`SELECT emp_id, SUM(attendance_value) as total FROM attendance_logs WHERE date LIKE ? AND emp_id IN (${placeholders}) GROUP BY emp_id`).all(`${month}%`, ...empIds) as any[];
  const attendanceMap = new Map();
  attendanceLogs.forEach(a => attendanceMap.set(a.emp_id, a.total));

  // 2. Working Day Types
  const wdtRows = primaryDb.prepare('SELECT * FROM working_day_types').all() as any[];
  const wdtMap = new Map();
  wdtRows.forEach(w => wdtMap.set(w.id, w));

  // 3. Transactions 
  const [yyyy, mm] = month.split('-');
  const txMonthYear = `${mm}-${yyyy}`;
  const allTx = primaryDb.prepare(`
    SELECT st.emp_id, st.transaction_type, st.amount, sh.name as head_name
    FROM salary_transactions st
    JOIN salary_heads sh ON st.head_id = sh.id
    WHERE st.salary_month_year = ? AND sh.allocation_type IN ('K_ONLY', 'KP') AND st.emp_id IN (${placeholders})
  `).all(txMonthYear, ...empIds) as any[];
  
  const earningsMap = new Map();
  const deductionsMap = new Map();
  allTx.forEach(tx => {
    if (tx.transaction_type === 'EARNING') {
       if (!earningsMap.has(tx.emp_id)) earningsMap.set(tx.emp_id, []);
       earningsMap.get(tx.emp_id).push(tx);
    } else if (tx.transaction_type === 'DEDUCTION') {
       if (!deductionsMap.has(tx.emp_id)) deductionsMap.set(tx.emp_id, []);
       deductionsMap.get(tx.emp_id).push(tx);
    }
  });

  // 4. Loans
  const allLoans = primaryDb.prepare(`
    SELECT l.emp_id, la.planned_amount 
    FROM loan_amortisation la 
    JOIN loan_applications l ON la.loan_app_id = l.id 
    WHERE la.month_year = ? AND la.status = 'DUE' AND l.emp_id IN (${placeholders})
  `).all(month, ...empIds) as any[];
  
  const loansMap = new Map();
  allLoans.forEach(l => {
     loansMap.set(l.emp_id, (loansMap.get(l.emp_id) || 0) + l.planned_amount);
  });

  // 5. Daily MIS Data
  const misMap = new Map();
  if (kEngineSource === 'DAILY_MIS') {
    const misLogs = primaryDb.prepare(`
      SELECT emp_id, 
             SUM(attendance_qty * worked_rate) as total_gross_wage, 
             SUM(attendance_qty) as total_attendance,
             SUM(CASE WHEN worked_rate = 0 THEN 1 ELSE 0 END) as zero_rate_count,
             SUM(CASE WHEN attendance_qty < 0 THEN 1 ELSE 0 END) as negative_attendance_count,
             COUNT(date) as entry_count,
             COUNT(DISTINCT date) as distinct_date_count
      FROM daily_mis_entries
      WHERE date LIKE ? AND emp_id IN (${placeholders})
      GROUP BY emp_id
    `).all(`${month}%`, ...empIds) as any[];
    misLogs.forEach(m => misMap.set(m.emp_id, m));
  }

  const queryEndTime = Date.now();
  const queryTime = queryEndTime - startTime;

  const results = employees.map(emp => {
    let divisor = 30;
    let workingDayConfigStr = 'DEFAULT (30)';
    if (emp.working_day_type_id) {
      const wdt = wdtMap.get(emp.working_day_type_id);
      if (wdt) {
        const wdResult = PayrollEngine.getWorkingDays(wdt, month);
        divisor = wdResult.divisor;
        workingDayConfigStr = wdResult.configStr;
      }
    }

    let kGrossWage = 0;
    let presentDays = 0;
    let exception = null;
    let rate = 0; // Derived later if needed

    if (kEngineSource === 'DAILY_MIS') {
      const misData = misMap.get(emp.id);
      if (!misData) {
        exception = 'Missing MIS rows';
        try {
          primaryDb.prepare('INSERT INTO payroll_exceptions (employee_id, salary_month, exception_type, message) VALUES (?, ?, ?, ?)').run(
            emp.id, month, 'MISSING_MIS', 'No Daily MIS entries found for this month'
          );
        } catch(e) {}
      } else if (misData.total_attendance === 0) {
        exception = 'Zero total attendance';
        try {
          primaryDb.prepare('INSERT INTO payroll_exceptions (employee_id, salary_month, exception_type, message) VALUES (?, ?, ?, ?)').run(
            emp.id, month, 'ZERO_ATTENDANCE', 'Total attendance is 0 for this month'
          );
        } catch(e) {}
      } else {
        if (misData.zero_rate_count > 0) {
          exception = 'Zero worked rate';
          try {
            primaryDb.prepare('INSERT INTO payroll_exceptions (employee_id, salary_month, exception_type, message) VALUES (?, ?, ?, ?)').run(
              emp.id, month, 'ZERO_RATE', `Found ${misData.zero_rate_count} entries with 0 worked rate`
            );
          } catch(e) {}
        }
        if (misData.negative_attendance_count > 0) {
          exception = exception || 'Negative attendance';
          try {
            primaryDb.prepare('INSERT INTO payroll_exceptions (employee_id, salary_month, exception_type, message) VALUES (?, ?, ?, ?)').run(
              emp.id, month, 'NEGATIVE_ATTENDANCE', `Found ${misData.negative_attendance_count} entries with negative attendance`
            );
          } catch(e) {}
        }
        if (misData.entry_count > misData.distinct_date_count) {
          exception = exception || 'Duplicate MIS entries';
          try {
            primaryDb.prepare('INSERT INTO payroll_exceptions (employee_id, salary_month, exception_type, message) VALUES (?, ?, ?, ?)').run(
              emp.id, month, 'DUPLICATE_DATES', `Found duplicate date entries: ${misData.entry_count} entries for ${misData.distinct_date_count} dates`
            );
          } catch(e) {}
        }
        kGrossWage = misData.total_gross_wage;
        presentDays = misData.total_attendance || 0;
      }
    } else {
      rate = PayrollEngine.getEffectiveRate(primaryDb, emp.id, month, 'K');
      presentDays = attendanceMap.get(emp.id) || 0;
      if (emp.wage_type === 'Daily') {
        kGrossWage = rate * presentDays;
      } else if (emp.wage_type === 'Monthly') {
        kGrossWage = (rate / divisor) * presentDays;
      } else {
        kGrossWage = rate;
      }
    }

    const kEarnings = earningsMap.get(emp.id) || [];
    let kOtherEarningsTotal = 0;
    const kOtherEarningsMap: Record<string, number> = {};
    kEarnings.forEach((e: any) => {
      kOtherEarningsMap[e.head_name] = (kOtherEarningsMap[e.head_name] || 0) + e.amount;
      kOtherEarningsTotal += e.amount;
    });

    const kDeductions = deductionsMap.get(emp.id) || [];
    let kDeductionsTotal = 0;
    const kDeductionsMap: Record<string, number> = {};
    kDeductions.forEach((d: any) => {
      kDeductionsMap[d.head_name] = (kDeductionsMap[d.head_name] || 0) + d.amount;
      kDeductionsTotal += d.amount;
    });

    const loanEmiK = loansMap.get(emp.id) || 0;
    if (loanEmiK > 0) {
      kDeductionsMap['LOAN_EMI'] = loanEmiK;
      kDeductionsTotal += loanEmiK;
    }

    const kGrossPayable = kGrossWage + kOtherEarningsTotal;
    const netPayableK = kGrossPayable - kDeductionsTotal;

    return {
      emp_id: emp.id,
      emp_code: emp.emp_code,
      name: emp.name,
      category: emp.category_name,
      class: emp.class_name,
      location: emp.location_name,
      division: emp.division_name,
      group_name: emp.group_name,
      department: emp.department_name,
      designation: emp.designation_name,
      reporting_name: emp.reporting_name,
      month_year: month,
      working_day_type: workingDayConfigStr,
      wage_type: emp.wage_type,
      wage_rate: rate,
      working_days: divisor,
      k_attendance: presentDays,
      k_gross_wage: kGrossWage,
      k_other_earnings: JSON.stringify(kOtherEarningsMap),
      k_gross_payable: kGrossPayable,
      k_deductions: JSON.stringify(kDeductionsMap),
      k_net_payable: netPayableK,
      payment_mode: emp.payment_mode,
      ifsc: emp.ifsc_code,
      bank_name: emp.bank_name,
      account_no: emp.account_no,
      exception: exception
    };
  });

  const processingTime = Date.now() - queryEndTime;
  const totalTime = Date.now() - startTime;
  
  console.log(`[Salary Processing] processed ${employees.length} employees using engine '${kEngineSource}'.`);
  console.log(`[Benchmark] query_time: ${queryTime}ms, processing_time: ${processingTime}ms, total_time: ${totalTime}ms`);

  salaryProcessingCache.set(`${month}-K`, results);
  res.json({
    employees: results,
    meta: {
      active_salary_engine: kEngineSource,
      query_time_ms: queryTime,
      processing_time_ms: processingTime,
      total_time_ms: totalTime,
      employee_count: employees.length
    }
  });
};

export const calculatePModuleStatutory: CommandHandler = (ctx, args) => {
  const { statutoryDb, primaryDb, res } = ctx;
  let { month, kResults } = args;
  if (!kResults || kResults.length === 0) {
     kResults = salaryProcessingCache.get(`${month}-K`) || [];
  }

  const statutoryUniformConfig = statutoryDb.prepare('SELECT * FROM working_day_types WHERE is_statutory_uniform = 1 LIMIT 1').get() as any;
  const uniformDays = statutoryUniformConfig ? PayrollEngine.getWorkingDays(statutoryUniformConfig, month).divisor : 30;

  // Fetch settings from DB
  const pfSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'PF' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const esiSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'ESI' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const ptSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'PTAX' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
  const lwfSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'LWF' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;

  let pfConfig = { ceiling_amount: 15000, employee_pct: 12 };
  let esiConfig = { eligibility_limit: 21000, employee_pct: 0.75 };
  let ptConfig: any = null;
  let lwfConfig: any = null;

  if (pfSettingsRow?.config) {
    try { pfConfig = { ...pfConfig, ...(typeof pfSettingsRow.config === 'string' ? JSON.parse(pfSettingsRow.config) : pfSettingsRow.config) }; } catch (e) { console.error('Failed to parse PF config', e); }
  }
  if (esiSettingsRow?.config) {
    try { esiConfig = { ...esiConfig, ...(typeof esiSettingsRow.config === 'string' ? JSON.parse(esiSettingsRow.config) : esiSettingsRow.config) }; } catch (e) { console.error('Failed to parse ESI config', e); }
  }
  if (ptSettingsRow?.config) {
    try { ptConfig = typeof ptSettingsRow.config === 'string' ? JSON.parse(ptSettingsRow.config) : ptSettingsRow.config; } catch (e) {}
  }
  if (lwfSettingsRow?.config) {
    try { lwfConfig = typeof lwfSettingsRow.config === 'string' ? JSON.parse(lwfSettingsRow.config) : lwfSettingsRow.config; } catch (e) {}
  }

  const allHeads = statutoryDb.prepare('SELECT * FROM salary_heads').all() as any[];

  const companyConfig = primaryDb.prepare('SELECT payroll_adjustment_head FROM company_config WHERE id = 1').get() as any;
  const payrollAdjustmentHead = companyConfig?.payroll_adjustment_head || 'Statutory Adjustment';

  // Bulk Load Dependencies
  const empCodes = kResults.map((k: any) => k.emp_code).filter(Boolean);
  const empIds = kResults.map((k: any) => k.emp_id).filter(Boolean);
  
  const placeholdersCodes = empCodes.map(() => '?').join(',');
  const statutoryEmps = statutoryDb.prepare(`SELECT * FROM employees WHERE emp_code IN (${placeholdersCodes})`).all(...empCodes) as any[];
  const statEmpMap = new Map();
  statutoryEmps.forEach(e => statEmpMap.set(e.emp_code, e));

  const placeholdersIds = empIds.map(() => '?').join(',');
  const primaryEmps = primaryDb.prepare(`SELECT id, statutory_wage_amount FROM employees WHERE id IN (${placeholdersIds})`).all(...empIds) as any[];
  const primaryEmpMap = new Map();
  primaryEmps.forEach(e => primaryEmpMap.set(e.id, e));

  const slabs = statutoryDb.prepare(`SELECT * FROM salary_slabs`).all() as any[];
  const slabMap = new Map();
  slabs.forEach(s => slabMap.set(s.id, s));

  // Note: getEffectiveRate could still do per-row, optimizing by ignoring it for now as bulk is hard because of effective dating constraints

  const results = kResults.map((k: any) => {
    const emp = statEmpMap.get(k.emp_code);
    if (!emp) return { ...k, error: 'Not in statutory' };

    // Sync Check: Audit Item 2 & HR-UDAN Rule 6 (Source of Truth is K-Module)
    let statRate = PayrollEngine.getEffectiveRate(statutoryDb, emp.id, month, 'P');
    const primaryEmp = primaryEmpMap.get(k.emp_id);
    
    if (primaryEmp && primaryEmp.statutory_wage_amount !== emp.statutory_wage_amount) {
      logError(statutoryDb, 'WARN', `Statutory rate mismatch for ${emp.emp_code}. Statutory: ${emp.statutory_wage_amount}, Primary: ${primaryEmp.statutory_wage_amount}. Prioritizing Primary.`);
      statRate = primaryEmp.statutory_wage_amount;
    }

    const pAttendance = PayrollEngine.calculateStatutoryAttendance(k.k_net_payable, statRate, uniformDays);
    
    // Logic Verification: Ensure attendance cap and remainder move to adjustment
    let pGrossWage = (statRate / uniformDays) * pAttendance;

    let headWiseRates: Record<string, number> = {};
    const slab = emp.slab_id ? slabMap.get(emp.slab_id) : null;
    
    if (slab && slab.components) {
      const comps = typeof slab.components === 'string' ? JSON.parse(slab.components) : slab.components;

      headWiseRates = calculateBifurcation(statRate, comps, allHeads);
    } else {
      headWiseRates = {
        Basic: emp.basic_salary || 0,
        HRA: emp.hra || 0,
        Conveyance: emp.conveyance || 0,
        'Special Allowance': emp.special_allowance || 0
      };
    }

    const pCtcHeads: Record<string, number> = {};
    let calculatedGross = 0;
    
    for (const [headPattern, headRate] of Object.entries(headWiseRates)) {
      if (headRate > 0) {
          // "Round each head's amount to 2 decimal places"
          const headAmount = parseFloat(((headRate / uniformDays) * pAttendance).toFixed(2));
          pCtcHeads[headPattern] = headAmount;
          calculatedGross += headAmount;
      }
    }
    
    // According to Step 5: "Due to flooring and capping... a residual amount may remain. Post this residual..."
    // We adjust pGrossWage to match the sum of CTC heads exactly, so PF/ESI are computed on exactly the distributed amount.
    // If calculatedGross is 0 (i.e. no heads defined), keep the original pGrossWage
    if (calculatedGross > 0) {
      pGrossWage = Number(calculatedGross.toFixed(2));
    } else {
      pGrossWage = Number(pGrossWage.toFixed(2));
    }

    const statDeds = PayrollEngine.calculateStatutoryDeductions(
      emp,
      0, // Pass 0 as draftGross because pCtcHeads already contains the full base wage components (e.g., Basic)
      pCtcHeads,
      allHeads,
      { pf: pfConfig, esi: esiConfig, pt: ptConfig, lwf: lwfConfig },
      month
    );

    let loanEmiP = 0;
    const loanDeductionsSql = `
      SELECT la.planned_amount 
      FROM loan_amortisation la 
      JOIN loan_applications l ON la.loan_app_id = l.id 
      WHERE l.emp_id = ? AND la.month_year = ? AND la.status = 'DUE' 
      AND l.payment_mode IN ('Cheque', 'Bank Transfer')
    `;
    const pendingLoansP = primaryDb.prepare(loanDeductionsSql).all(k.emp_id, month) as any[];
    pendingLoansP.forEach(l => {
      loanEmiP += l.planned_amount;
    });

    const pDeductionsMap = { ...statDeds.breakdown };
    if (loanEmiP > 0) {
      pDeductionsMap['LOAN_EMI'] = loanEmiP;
    }

    // Include loanEmiP in adjustment so that net_payable_final still matches k_net_payable exactly
    const adjustmentAmount = PayrollEngine.calculateStatutoryAdjustment(k.k_net_payable, pGrossWage, statDeds.PF, statDeds.ESI, statDeds.PT, statDeds.LWF) + loanEmiP;
    const pOtherEarningsKP: Record<string, number> = {};
    if (adjustmentAmount !== 0) {
      pOtherEarningsKP[payrollAdjustmentHead] = adjustmentAmount;
    }

    return {
      ...k,
      statutory_rate: statRate,
      head_wise_rates: JSON.stringify(headWiseRates),
      p_working_days: uniformDays,
      p_attendance: pAttendance,
      p_gross_wage: pGrossWage,
      p_ctc_heads: JSON.stringify(pCtcHeads),
      p_other_earnings_kp: JSON.stringify(pOtherEarningsKP),
      p_gross_statutory_payable: pGrossWage + adjustmentAmount,
      p_deductions: JSON.stringify(pDeductionsMap),
      net_payable_final: (pGrossWage + adjustmentAmount) - statDeds.PF - statDeds.ESI - statDeds.PT - statDeds.LWF - loanEmiP
    };
  });

  salaryProcessingCache.set(`${month}-P`, results);
  res.json(results);
};

export const consolidateFinalPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  let { month, results } = args;
  if (!results || results.length === 0) {
    results = salaryProcessingCache.get(`${month}-P`) || [];
  }

  try {
    primaryDb.transaction(() => {
      primaryDb.prepare('DELETE FROM final_payroll WHERE month_year = ?').run(month);
      const stmt = primaryDb.prepare(`
        INSERT INTO final_payroll (
          emp_code, name, category, class, location, division, group_name, department, designation, reporting_name,
          month_year, working_day_type, wage_type, wage_rate, working_days, k_attendance, k_gross_wage, k_other_earnings,
          k_gross_payable, k_deductions, k_net_payable, statutory_rate, head_wise_rates, p_working_days, p_attendance, 
          p_gross_wage, p_ctc_heads, p_other_earnings_kp, p_gross_statutory_payable, p_deductions, net_payable_final,
          payment_mode, ifsc, bank_name, account_no, salary_source_engine
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const r of results) {
        const kOtherEarnings = JSON.parse(r.k_other_earnings || '{}');

        const kDeductionsRaw = JSON.parse(r.k_deductions || '{}');
        
        const kpEarningsHeads = primaryDb.prepare("SELECT name FROM salary_heads WHERE allocation_type = 'KP' AND type = 'EARNING' AND status = 1").all() as any[];
        const kpDeductionsHeads = primaryDb.prepare("SELECT name FROM salary_heads WHERE allocation_type = 'KP' AND type = 'DEDUCTION' AND status = 1").all() as any[];
        
        // pOtherEarningsKP might already have 'Statutory Adjustment' from calculatePModuleStatutory 
        const pOtherEarningsKP: Record<string, number> = JSON.parse(r.p_other_earnings_kp || '{}');
        const pDeductionsMap = JSON.parse(r.p_deductions || '{}');

        kpEarningsHeads.forEach(head => {
          if (kOtherEarnings[head.name]) {
            pOtherEarningsKP[head.name] = (pOtherEarningsKP[head.name] || 0) + kOtherEarnings[head.name];
          }
        });
        
        kpDeductionsHeads.forEach(head => {
          if (kDeductionsRaw[head.name]) {
            pDeductionsMap[head.name] = (pDeductionsMap[head.name] || 0) + kDeductionsRaw[head.name];
          }
        });

        let totalOtherEarnings = 0;
        Object.values(pOtherEarningsKP).forEach((val: any) => totalOtherEarnings += Number(val) || 0);

        const pGrossStatutoryPayable = (Number(r.p_gross_wage) || 0) + totalOtherEarnings;
        
        const pDeductionsTotal = Object.values(pDeductionsMap).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        const netPayableFinal = (pGrossStatutoryPayable as number) - (pDeductionsTotal as number);

        stmt.run(
          r.emp_code, r.name, r.category, r.class, r.location, r.division, r.group_name, r.department, r.designation, r.reporting_name,
          r.month_year, r.working_day_type, r.wage_type, r.wage_rate, r.working_days, r.k_attendance, r.k_gross_wage, r.k_other_earnings,
          r.k_gross_payable, r.k_deductions, r.k_net_payable, r.statutory_rate, r.head_wise_rates || '{}', r.p_working_days, r.p_attendance,
          r.p_gross_wage, r.p_ctc_heads || '{}', JSON.stringify(pOtherEarningsKP), pGrossStatutoryPayable, JSON.stringify(pDeductionsMap), netPayableFinal,
          r.payment_mode, r.ifsc, r.bank_name, r.account_no,
          r.salary_source_engine || 'EMPLOYEE_MASTER'
        );
      }
    })();
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Consolidation failed' });
  }
};

export const commitPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { month, preview, moduleType, userId } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  try {
    db.transaction(() => {
      for (const item of preview) {
        const logs = db.prepare('SELECT * FROM attendance_logs WHERE emp_id = ? AND date LIKE ?').all(item.emp_id, `${month}%`) as any[];
        for (const log of logs) {
          primaryDb.prepare(`
            INSERT OR REPLACE INTO wage_attendance_transactions 
            (emp_id, date, punch_in, punch_out, total_time_mins, worked_mins, outside_mins, shift_id, attendance_value, status, is_missed_punch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(log.emp_id, log.date, log.punch_in, log.punch_out, log.total_time_mins, log.worked_mins, log.outside_mins, log.shift_id, log.attendance_value, log.status, log.is_missed_punch);
        }

        if (item.adjusted_leave > 0) {
          let remaining = item.adjusted_leave;
          const absents = primaryDb.prepare('SELECT date FROM wage_attendance_transactions WHERE emp_id = ? AND date LIKE ? AND attendance_value < 1.0').all(item.emp_id, `${month}%`) as any[];
          const configs = primaryDb.prepare('SELECT id FROM leave_configurations WHERE status = 1 ORDER BY adjustment_priority ASC').all() as any[];

          for (const day of absents) {
            if (remaining <= 0) break;
            for (const config of configs) {
              const bal = (primaryDb.prepare('SELECT balance FROM leave_balances WHERE emp_id = ? AND leave_config_id = ?').get(item.emp_id, config.id) as any)?.balance || 0;
              if (bal >= 1) {
                primaryDb.prepare("UPDATE wage_attendance_transactions SET leave_adjusted_id = ?, attendance_value = 1.0, status = 'Paid Leave' WHERE emp_id = ? AND date = ?").run(config.id, item.emp_id, day.date);
                primaryDb.prepare('UPDATE leave_balances SET balance = balance - 1 WHERE emp_id = ? AND leave_config_id = ?').run(item.emp_id, config.id);
                remaining -= 1;
                break;
              }
            }
          }
        }

        const workingDayConfig = item.working_day_config || 'DEFAULT (30)';

        db.prepare(`
          INSERT OR REPLACE INTO payroll 
          (emp_id, month, type_name, actual_attendance, statutory_attendance, actual_earning, pf, esi, loan_emi, canteen_deduction, net_payable, statutory_gross, adjusted_diff, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Committed')
        `).run(
          item.emp_id, month, moduleType, item.actual_attendance, item.statutory_attendance, item.actual_earning, item.pf, item.esi, item.loan_emi, item.canteen_deduction, item.diff, item.statutory_gross, item.adjusted_diff
        );

        if (moduleType === 'P') {
          statutoryDb.prepare(`
            INSERT OR REPLACE INTO statutory_records (emp_id, month, name, statutory_attendance, gross_earning, pf_contribution, esi_contribution, net_statutory)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.emp_id, month, item.name, item.statutory_attendance, item.actual_earning, item.pf, item.esi, item.diff);
          
          statutoryDb.prepare(`
            INSERT OR REPLACE INTO salary_locks 
            (month, emp_id, module_type, is_locked, locked_by_id, snapshot_config)
            VALUES (?, ?, ?, 1, ?, ?)
          `).run(month, item.emp_id, 'P', userId, workingDayConfig);

          // Record Gratuity Provision (Liability Tracking)
          PayrollEngine.recordGratuityProvision(statutoryDb, item.emp_id, month, item.statutory_rate || item.wage_amount || 0);
        }
      }
    })();
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to commit payroll' });
  }
};

export const updatePayrollStatus: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { month, moduleType, status, approvedBy, empId } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  try {
    if (empId) {
      db.prepare('UPDATE payroll SET status = ?, approved_by = ?, locked_at = ? WHERE month = ? AND type_name = ? AND emp_id = ?')
        .run(status, approvedBy, status === 'Locked' ? new Date().toISOString() : null, month, moduleType, empId);
    } else {
      db.prepare('UPDATE payroll SET status = ?, approved_by = ?, locked_at = ? WHERE month = ? AND type_name = ?')
        .run(status, approvedBy, status === 'Locked' ? new Date().toISOString() : null, month, moduleType);
    }
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payroll status' });
  }
};

export const getProcessedPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { month, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  const rows = db.prepare(`
    SELECT p.*, e.name, e.blacklist_status,
           (SELECT SUM(balance) FROM leave_balances WHERE emp_id = e.id) as balance_leave
    FROM payroll p
    JOIN employees e ON p.emp_id = e.id
    WHERE p.month = ? AND p.type_name = ?
  `).all(month, moduleType);
  res.json(rows);
};

export const pieceRateCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { operation, data, id, page, limit, search } = args;
          const { PieceRateService } = require('./domains/piece-rate/service');
          const service = new PieceRateService(primaryDb);
          
          if (operation === 'list') {
            const result = service.getHeads(parseInt(page || '1'), parseInt(limit || '20'), search || '');
            res.json({ success: true, ...result });
          } else if (operation === 'create' || operation === 'update') {
            const user = req.headers['x-user-id'] as string || 'system';
            const resultId = service.saveHeadWithDetails(data, user);
            res.json({ success: true, data: { id: resultId } });
          } else if (operation === 'delete') {
            service.deleteHead(id);
            res.json({ success: true });
          } else if (operation === 'upload') {
            const user = req.headers['x-user-id'] as string || 'system';
            let upserted = 0;
            const configs = data;
            if (!Array.isArray(configs)) {
                return res.status(400).json({ success: false, error: 'Data must be an array' });
            }
            for (const config of configs) {
                const existing = primaryDb.prepare('SELECT id FROM piece_rate_heads WHERE name = ?').get(config.name) as {id: string};
                if (existing) {
                    config.id = existing.id;
                }
                service.saveHeadWithDetails(config, user);
                upserted++;
            }
            res.json({ success: true, message: `Successfully upserted ${upserted} configurations.` });
          
}
};

export const processPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  if (isSystemProcessing) return res.status(409).json({ error: 'System is currently processing another heavy task. Please wait.' });
          
          const { month } = args;
          if (!month) return res.status(400).json({ error: 'Month is required' });

          try {
            primaryDb.exec('CREATE TABLE IF NOT EXISTS payroll_lock (month_year TEXT PRIMARY KEY, status TEXT, input_hash TEXT, locked_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
          } catch(e) {}

          const currentLock = primaryDb.prepare('SELECT status FROM payroll_lock WHERE month_year = ?').get(month) as any;
          if (currentLock) {
            if (currentLock.status === 'PROCESSING') return res.status(400).json({ error: `Payroll for ${month} is currently processing.` });
            if (currentLock.status === 'FINALIZED') return res.status(400).json({ error: `Payroll for ${month} has already been finalized.` });
          }

          isSystemProcessing = true;
          try {
             const tx = primaryDb.transaction(() => {
                const inputHash = "hash_" + new Date().getTime();
                primaryDb.prepare("INSERT OR REPLACE INTO payroll_lock (month_year, status, input_hash) VALUES (?, 'PROCESSING', ?)").run(month, inputHash);

                primaryDb.exec(`
                  CREATE TEMP TABLE IF NOT EXISTS temp_k_results (emp_id INTEGER, data TEXT);
                  CREATE TEMP TABLE IF NOT EXISTS temp_p_results (emp_id INTEGER, data TEXT);
                  DELETE FROM temp_k_results;
                  DELETE FROM temp_p_results;
                `);

                // ---- K MODULE CALCULATION ----
                const sql = `
             SELECT e.*, d.name as department_name, des.name as designation_name,
                    c.name as category_name, cl.name as class_name,
                    loc.name as location_name, div.name as division_name,
                    g.name as group_name, rep.name as reporting_name
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             LEFT JOIN designations des ON e.designation_id = des.id
             LEFT JOIN categories c ON e.category_id = c.id
             LEFT JOIN classes cl ON e.class_id = cl.id
             LEFT JOIN locations loc ON e.location_id = loc.id
             LEFT JOIN divisions div ON e.division_id = div.id
             LEFT JOIN groups g ON e.group_id = g.id
             LEFT JOIN employees rep ON e.reporting_employee_id = rep.id
             WHERE e.status = 1
                `;
                const employees = primaryDb.prepare(sql).all() as any[];

                const kResults = employees.map(emp => {
                  const queryDate = month + '-31';
                  const historyRate = primaryDb.prepare("SELECT amount, effective_date FROM salary_rate_history WHERE emp_id = ? AND type = 'WAGE' AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1").get(emp.id, queryDate) as any;
                  const rate = historyRate ? historyRate.amount : (emp.wage_amount || 0);

                  let divisor = 30;
                  let workingDayConfigStr = 'DEFAULT (30)';
                  if (emp.working_day_type_id) {
                    const wdt = primaryDb.prepare('SELECT * FROM working_day_types WHERE id = ?').get(emp.working_day_type_id) as any;
                    const wdResult = PayrollEngineK.getWorkingDays(wdt, month);
                    divisor = wdResult.divisor;
                    workingDayConfigStr = wdResult.configStr;
                  }

                  let presentDays = 0;
                  const rangeDays = divisor;
                  const presentLog = primaryDb.prepare('SELECT SUM(attendance_value) as total FROM attendance_logs WHERE emp_id = ? AND date LIKE ?').get(emp.id, `${month}%`) as any;
                  presentDays = presentLog?.total || 0;

                  let kGrossWage = 0;
                  const kEffectiveAttendance = presentDays;
                  if (emp.wage_type === 'Daily') {
                    kGrossWage = rate * presentDays;
                  } else if (emp.wage_type === 'Monthly') {
                    kGrossWage = (rate / divisor) * presentDays;
                  } else {
                    kGrossWage = (rate / divisor) * presentDays;
                  }

                  const [yyyy, mm] = month.split('-');
                  const txMonthYear = `${mm}-${yyyy}`;

                  const earningsSql = `
                    SELECT sh.name, st.amount, sh.allocation_type 
                    FROM salary_transactions st
                    JOIN salary_heads sh ON st.head_id = sh.id
                    WHERE st.emp_id = ? AND st.salary_month_year = ? AND st.transaction_type = 'EARNING'
                  `;
                  const allEarnings = primaryDb.prepare(earningsSql).all(emp.id, txMonthYear) as any[];
                  let kOtherEarningsTotal = 0;
                  const kOtherEarningsMap: Record<string, number> = {};
                  allEarnings.forEach(e => {
                    if (e.allocation_type === 'K_ONLY') {
                      kOtherEarningsMap[e.name] = (kOtherEarningsMap[e.name] || 0) + e.amount;
                      kOtherEarningsTotal += e.amount;
                    }
                  });

                  const deductionsSql = `
                    SELECT sh.name, st.amount, sh.allocation_type 
                    FROM salary_transactions st
                    JOIN salary_heads sh ON st.head_id = sh.id
                    WHERE st.emp_id = ? AND st.salary_month_year = ? AND st.transaction_type = 'DEDUCTION'
                  `;
                  const allDeductions = primaryDb.prepare(deductionsSql).all(emp.id, txMonthYear) as any[];
                  let kDeductionsTotal = 0;
                  const kDeductionsMap: Record<string, number> = {};
                  allDeductions.forEach(d => {
                    if (d.allocation_type === 'K_ONLY') {
                      kDeductionsMap[d.name] = (kDeductionsMap[d.name] || 0) + d.amount;
                      kDeductionsTotal += d.amount;
                    }
                  });

                  const kGrossPayable = kGrossWage + kOtherEarningsTotal;
                  const netPayableK = kGrossPayable - kDeductionsTotal;

                  return {
                    emp_id: emp.id,
                    emp_code: emp.emp_code,
                    name: emp.name,
                    category: emp.category_name,
                    class: emp.class_name,
                    location: emp.location_name,
                    division: emp.division_name,
                    group_name: emp.group_name,
                    department: emp.department_name,
                    designation: emp.designation_name,
                    reporting_name: emp.reporting_name,
                    month_year: month,
                    working_day_type: workingDayConfigStr,
                    wage_type: emp.wage_type,
                    wage_rate: rate,
                    working_days: divisor,
                    k_attendance: kEffectiveAttendance,
                    k_gross_wage: kGrossWage,
                    k_other_earnings: JSON.stringify(kOtherEarningsMap),
                    k_gross_payable: kGrossPayable,
                    k_deductions: JSON.stringify(kDeductionsMap),
                    k_net_payable: netPayableK,
                    range_days: rangeDays,
                    payment_mode: emp.payment_mode,
                    ifsc: emp.ifsc_code,
                    bank_name: emp.bank_name,
                    account_no: emp.account_no
                  };
                });

                const insertKTemp = primaryDb.prepare('INSERT INTO temp_k_results (emp_id, data) VALUES (?, ?)');
                for (const k of kResults) insertKTemp.run(k.emp_id, JSON.stringify(k));

                // ---- P MODULE CALCULATION ----
                const statutoryUniformConfig = statutoryDb.prepare('SELECT * FROM working_day_types WHERE is_statutory_uniform = 1 LIMIT 1').get() as any;
                const uniformDays = statutoryUniformConfig ? PayrollEngineK.getWorkingDays(statutoryUniformConfig, month).divisor : 30;

                const queryDate = month + '-31';
                const pfSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'PF' AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1").get(queryDate) as any;
                const esiSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'ESI' AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1").get(queryDate) as any;
                
                const pfConfig = pfSettingsRow && pfSettingsRow.config ? JSON.parse(pfSettingsRow.config) : { employee_contribution_rate: 12, wage_limit: 15000 };
                const esiConfig = esiSettingsRow && esiSettingsRow.config ? JSON.parse(esiSettingsRow.config) : { employee_contribution_rate: 0.75, wage_limit: 21000 };

                const mergedResults = kResults.map((k: any) => {
                  const emp = statutoryDb.prepare('SELECT * FROM employees WHERE id = ?').get(k.emp_id) as any;
                  if (!emp) return { ...k, error: 'Not in statutory' };

                  const basic = emp.basic_salary || 0;
                  const hra = emp.hra || 0;
                  const conveyance = emp.conveyance || 0;
                  const statRate = basic + hra + conveyance;

                  let pAttendance = 0;
                  if (statRate > 0) {
                    pAttendance = k.k_net_payable / (statRate / uniformDays);
                  }
                  pAttendance = Math.floor(pAttendance);
                  if (k.k_attendance !== undefined && k.k_attendance !== null && k.k_attendance > 0) {
                    pAttendance = Math.min(pAttendance, k.k_attendance);
                  } else {
                    pAttendance = Math.min(pAttendance, uniformDays);
                  }

                  const [yyyy, mm] = month.split('-');
                  const txMonthYear = `${mm}-${yyyy}`;

                  const kpEarningsSql = `
                    SELECT sh.name, st.amount 
                    FROM salary_transactions st
                    JOIN salary_heads sh ON st.head_id = sh.id
                    WHERE st.emp_id = ? AND st.salary_month_year = ? AND st.transaction_type = 'EARNING' AND sh.allocation_type = 'KP' AND sh.status = 1
                  `;
                  const pOtherEarningsKP: Record<string, number> = {};
                  let kpEarningsTotal = 0;
                  const kpEarnings = statutoryDb.prepare(kpEarningsSql).all(k.emp_id, txMonthYear) as any[];
                  kpEarnings.forEach(e => {
                    pOtherEarningsKP[e.name] = (pOtherEarningsKP[e.name] || 0) + e.amount;
                    kpEarningsTotal += e.amount;
                  });

                  const kpDeductionsSql = `
                    SELECT sh.name, st.amount 
                    FROM salary_transactions st
                    JOIN salary_heads sh ON st.head_id = sh.id
                    WHERE st.emp_id = ? AND st.salary_month_year = ? AND st.transaction_type = 'DEDUCTION' AND sh.allocation_type = 'KP' AND sh.status = 1
                  `;
                  const pOtherDeductionsKP: Record<string, number> = {};
                  let kpDeductionsTotal = 0;
                  const kpDeductions = statutoryDb.prepare(kpDeductionsSql).all(k.emp_id, txMonthYear) as any[];
                  kpDeductions.forEach(d => {
                    pOtherDeductionsKP[d.name] = (pOtherDeductionsKP[d.name] || 0) + d.amount;
                    kpDeductionsTotal += d.amount;
                  });

                  const pGrossWage = Math.round((statRate / uniformDays) * pAttendance);

                  const basicEarned = basic > 0 ? Math.round((basic / uniformDays) * pAttendance) : pGrossWage;
                  
                  const pfLimit = pfConfig.wage_limit || 15000;
                  const pfRate = (pfConfig.employee_contribution_rate || 12) / 100;
                  const pfBase = Math.min(basicEarned, pfLimit);
                  const pf = Math.round(pfBase * pfRate);
                  
                  const esiLimit = esiConfig.wage_limit || 21000;
                  const esiRate = (esiConfig.employee_contribution_rate || 0.75) / 100;
                  const esi = pGrossWage <= esiLimit ? Math.ceil(pGrossWage * esiRate) : 0;
                  
                  const pDeductionsMap: Record<string, number> = { PF: pf, ESI: esi, ...pOtherDeductionsKP };
                  const pDeductionsTotal = pf + esi + kpDeductionsTotal;

                  const adjustment = Math.round(k.k_net_payable + pDeductionsTotal - pGrossWage - kpEarningsTotal);
                  
                  const pGrossStatutoryPayable = pGrossWage + adjustment + kpEarningsTotal;
                  const pNetPayable = pGrossStatutoryPayable - pDeductionsTotal;

                  return {
                    ...k,
                    statutory_rate: statRate,
                    p_working_days: uniformDays,
                    p_attendance: pAttendance,
                    p_gross_wage: pGrossWage,
                    p_other_earnings_kp: JSON.stringify(pOtherEarningsKP), 
                    p_gross_statutory_payable: pGrossStatutoryPayable,
                    p_deductions: JSON.stringify(pDeductionsMap),
                    net_payable_final: pNetPayable
                  };
                });

                const insertPTemp = primaryDb.prepare('INSERT INTO temp_p_results (emp_id, data) VALUES (?, ?)');
                for (const m of mergedResults) insertPTemp.run(m.emp_id, JSON.stringify(m));

                // ---- CONSOLIDATE ----
                primaryDb.prepare('DELETE FROM final_payroll WHERE month_year = ?').run(month);
                statutoryDb.prepare('DELETE FROM final_payroll WHERE month_year = ?').run(month);

                const kStmt = primaryDb.prepare(`
                  INSERT INTO final_payroll (
                     emp_code, name, category, class, location, division, group_name, department, designation, reporting_name,
                     month_year, working_day_type, wage_type, wage_rate, working_days, k_attendance, k_gross_wage, k_other_earnings,
                     k_gross_payable, k_deductions, k_net_payable, payment_mode, ifsc, bank_name, account_no, salary_source_engine
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const pStmt = statutoryDb.prepare(`
                  INSERT INTO final_payroll (
                     emp_code, name, category, class, location, division, group_name, department, designation, reporting_name,
                     month_year, statutory_rate, head_wise_rates, p_working_days, p_attendance, 
                     p_gross_wage, p_ctc_heads, p_other_earnings_kp, p_gross_statutory_payable, p_deductions, net_payable_final,
                     payment_mode, ifsc, bank_name, account_no, salary_source_engine
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const r of mergedResults) {
                  // Insert K module data into primaryDb
                  kStmt.run(
                    r.emp_code, r.name, r.category, r.class, r.location, r.division, r.group_name, r.department, r.designation, r.reporting_name,
                    r.month_year, r.working_day_type, r.wage_type, r.wage_rate, r.working_days, r.k_attendance, r.k_gross_wage, r.k_other_earnings,
                    r.k_gross_payable, r.k_deductions, r.k_net_payable, r.payment_mode, r.ifsc, r.bank_name, r.account_no,
                    r.salary_source_engine || 'EMPLOYEE_MASTER'
                  );
                  
                  // Insert P module data into statutoryDb (for Audit Mode independence)
                  pStmt.run(
                    r.emp_code, r.name, r.category, r.class, r.location, r.division, r.group_name, r.department, r.designation, r.reporting_name,
                    r.month_year, r.statutory_rate, r.head_wise_rates || '{}', r.p_working_days, r.p_attendance,
                    r.p_gross_wage, r.p_ctc_heads || '{}', r.p_other_earnings_kp || '{}', r.p_gross_statutory_payable, r.p_deductions, r.net_payable_final,
                    r.payment_mode, r.ifsc, r.bank_name, r.account_no,
                    r.salary_source_engine || 'EMPLOYEE_MASTER'
                  );
                }

                primaryDb.prepare("UPDATE payroll_lock SET status = 'FINALIZED' WHERE month_year = ?").run(month);
             });
             tx.immediate(); // Execute transaction
             res.json({ status: 'success' });
          } catch (e: any) {
             console.error('[Payroll Error]', e);
             res.status(500).json({ error: e.message || 'Fatal error processing payroll' });
          } finally {
             isSystemProcessing = false;
          
}
};

export const getFinalPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { month } = args;
          const records = primaryDb.prepare('SELECT * FROM final_payroll WHERE month_year = ?').all(month) as any[];
          const processedRows = records.map((row: any) => {
            const parsed: any = { ...row };
            const jsonCols = ['k_other_earnings', 'k_deductions', 'p_other_earnings_kp', 'p_deductions', 'head_wise_rates', 'p_ctc_heads'];
            jsonCols.forEach(col => {
              if (row[col] && typeof row[col] === 'string') {
                try {
                  parsed[col] = JSON.parse(row[col]);
                } catch(e) {}
              }
            });
            return {
              ...parsed,
              ...Object.fromEntries(Object.entries(parsed.head_wise_rates || {}).map(([k, v]) => [`rate_${k}`, v])),
              ...Object.fromEntries(Object.entries(parsed.k_other_earnings || {}).map(([k, v]) => [`k_earning_${k}`, v])),
              ...Object.fromEntries(Object.entries(parsed.k_deductions || {}).map(([k, v]) => [`k_deduction_${k}`, v])),
              ...Object.fromEntries(Object.entries(parsed.p_other_earnings_kp || {}).map(([k, v]) => [`p_earning_${k}`, v])),
              ...Object.fromEntries(Object.entries(parsed.p_deductions || {}).map(([k, v]) => [`p_deduction_${k}`, v])),
              ...Object.fromEntries(Object.entries(parsed.p_ctc_heads || {}).map(([k, v]) => [`p_ctc_head_${k}`, v])),
            };
          });
          res.json(processedRows);
          
};

export const processWaterfallDistribution: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { parent_id, month, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;

          try {
            const parent = db.prepare('SELECT * FROM employees WHERE id = ?').get(parent_id) as any;
            if (!parent) return res.status(404).json({ error: 'Parent employee not found' });

            // Calculate Parent's Pool (Total Part A)
            // Using a simple logic: attendance_value * rate
            const parentAttendance = (db.prepare('SELECT SUM(attendance_value) as total FROM wage_attendance_transactions WHERE emp_id = ? AND date LIKE ?').get(parent_id, `${month}%`) as any).total || 0;
            const totalPool = (parent.wage_amount || 0) * parentAttendance;
            
            let currentPool = totalPool;
            const logs = [];

            // Get children sorted by sequence
            const children = db.prepare(`
              SELECT * FROM employees 
              WHERE parent_employee_id = ? AND status = 1 
              ORDER BY salary_process_sequence ASC
            `).all(parent_id) as any[];

            for (const child of children) {
              const childAttendance = (db.prepare('SELECT SUM(attendance_value) as total FROM wage_attendance_transactions WHERE emp_id = ? AND date LIKE ?').get(child.id, `${month}%`) as any).total || 0;
              const childPartB = (child.wage_amount || 0) * childAttendance;
              
              const poolBefore = currentPool;
              const actualDeduction = Math.min(currentPool, childPartB);
              currentPool -= actualDeduction;
              
              logs.push({
                parent_id,
                child_id: child.id,
                month,
                pool_before: poolBefore,
                deduction: actualDeduction,
                pool_after: currentPool,
                module_type: moduleType
              });
            }

            // Save distribution logs
            const insertLog = db.prepare(`
              INSERT INTO waterfall_logs (parent_id, child_id, month, pool_before, deduction, pool_after, module_type)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const transaction = db.transaction((data) => {
              for (const log of data) {
                insertLog.run(log.parent_id, log.child_id, log.month, log.pool_before, log.deduction, log.pool_after, log.module_type);
              }
            });
            transaction(logs);

            res.json({ 
              status: 'success', 
              totalPool, 
              residual: currentPool, 
              distributed: totalPool - currentPool,
              logs 
            });
          } catch (err: any) {
            console.error('[Waterfall] Error:', err);
            res.status(500).json({ error: err.message });
          
}
};

export const getPayrollPreview: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { month, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          
          const employees = db.prepare('SELECT * FROM employees WHERE status = 1').all() as any[];
          const leaveConfigs = db.prepare('SELECT * FROM leave_configurations WHERE status = 1 ORDER BY adjustment_priority ASC').all() as any[];

          const attLogs = db.prepare('SELECT emp_id, SUM(attendance_value) as total FROM wage_attendance_transactions WHERE date LIKE ? GROUP BY emp_id').all(`${month}%`) as any[];
          const attMap = new Map(attLogs.map(a => [a.emp_id, a.total]));

          const leaveBals = db.prepare('SELECT emp_id, leave_config_id, balance FROM leave_balances').all() as any[];
          const balMap = new Map();
          leaveBals.forEach(b => {
             if (!balMap.has(b.emp_id)) balMap.set(b.emp_id, {});
             balMap.get(b.emp_id)[b.leave_config_id] = b.balance;
          });

          // Fetch Statutory Configurations (Effective Date filtering)
          const pfSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'PF' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
          const esiSettingsRow = statutoryDb.prepare("SELECT config FROM statutory_settings WHERE type = 'ESI' AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1").get() as any;
          const pfConfig = pfSettingsRow && pfSettingsRow.config ? JSON.parse(pfSettingsRow.config) : { employee_contribution_rate: 12, wage_limit: 15000 };
          const esiConfig = esiSettingsRow && esiSettingsRow.config ? JSON.parse(esiSettingsRow.config) : { employee_contribution_rate: 0.75, wage_limit: 21000 };

          const canteenDeductions = db.prepare('SELECT emp_id, total_deduction FROM canteen_deductions_cache WHERE month = ?').all(month) as any[];
          const canteenMap = new Map(canteenDeductions.map(c => [c.emp_id, c.total_deduction]));

          const locks = db.prepare('SELECT emp_id, is_locked FROM salary_locks WHERE month = ? AND module_type = ?').all(month, moduleType) as any[];
          const lockMap = new Map(locks.map(l => [l.emp_id, l.is_locked]));

          const totalBals = db.prepare('SELECT emp_id, SUM(balance) as total FROM leave_balances GROUP BY emp_id').all() as any[];
          const totalBalMap = new Map(totalBals.map(b => [b.emp_id, b.total]));

          const preview = employees.map(emp => {
            const presentDays = attMap.get(emp.id) || 0;
            
            let absence = 30 - presentDays;
            let adjusted_leave = 0;

            if (absence > 0) {
              const empBals = balMap.get(emp.id) || {};
              for (const config of leaveConfigs) {
                const bal = empBals[config.id] || 0;
                if (bal > 0) {
                  const adjust = Math.min(bal, absence);
                  absence -= adjust;
                  adjusted_leave += adjust;
                  if (absence <= 0) break;
                }
              }
            }
            
            // Generate standard days (e.g. standard 26 present, 4 weekly offs)
            // K_Present for P-module is ideally P_Present or generated.
            // Statutory default assumption for present calculation:
            // total_days_in_month = 30
            // weekly_offs = 4
            // statutory_present = 30 - 4 - absence
            // Or simpler: standardize to 26 days.
            const statutory_present = Math.max(0, 26 - absence);
            return {
              emp_id: emp.id,
              emp_code: emp.emp_code,
              name: emp.name,
              total_days: 30,
              present: statutory_present,
              weekly_off: 4,
              holiday: 0,
              paid_leave: adjusted_leave,
              unpaid_leave: absence,
              leave_balance: totalBalMap.get(emp.id) || 0,
              is_locked: lockMap.get(emp.id) ? 1 : 0
            };
          });

          res.json({ status: 'success', data: preview });
};

export const toggleSalaryLock: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { month, empId, moduleType, isLocked, userId, userRole } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;

          try {
            if (!isLocked) {
              // Unlocking check: Only Super Admin or Admin
              if (userRole !== 'Super Admin' && userRole !== 'Admin') {
                return res.status(403).json({ error: 'Only Admins can unlock salary records' });
              }
              db.prepare('DELETE FROM salary_locks WHERE month = ? AND emp_id = ? AND module_type = ?').run(month, empId, moduleType);
            } else {
              // Locking: Fetch snapshot data
              const emp = db.prepare('SELECT wage_amount, account_no, ifsc_code FROM employees WHERE id = ?').get(empId) as any;
              if (!emp) return res.status(404).json({ error: 'Employee not found' });

              db.prepare(`
                INSERT OR REPLACE INTO salary_locks 
                (month, emp_id, module_type, is_locked, locked_by_id, snapshot_wage_rate, snapshot_bank_acc, snapshot_ifsc)
                VALUES (?, ?, ?, 1, ?, ?, ?, ?)
              `).run(month, empId, moduleType, userId, emp.wage_amount, emp.account_no, emp.ifsc_code);
            }
            res.json({ status: 'success' });
          } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to toggle salary lock' });
          
}
};

export const bulkSalaryLock: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { month, empIds, moduleType, userId } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;

          try {
            const transaction = db.transaction((ids) => {
              const stmt = db.prepare(`
                INSERT OR REPLACE INTO salary_locks 
                (month, emp_id, module_type, is_locked, locked_by_id, snapshot_wage_rate, snapshot_bank_acc, snapshot_ifsc)
                SELECT ?, id, ?, 1, ?, wage_amount, account_no, ifsc_code FROM employees WHERE id = ?
              `);
              for (const id of ids) {
                stmt.run(month, moduleType, userId, id);
              }
            });
            transaction(empIds);
            res.json({ status: 'success' });
          } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to bulk lock salary' });
          
}
};

export const exportFinalPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { monthYear } = args;
          if (!monthYear) return res.status(400).json({ error: 'monthYear is required' });
          try {
            const records = primaryDb.prepare('SELECT * FROM final_payroll WHERE month_year = ?').all(monthYear) as any[];
            const processedRows = records.map((row: any) => {
              const parsed: any = { ...row };
              const jsonCols = ['k_other_earnings', 'k_deductions', 'p_other_earnings_kp', 'p_deductions', 'head_wise_rates', 'p_ctc_heads'];
              jsonCols.forEach(col => {
                if (row[col] && typeof row[col] === 'string') {
                  try {
                    parsed[col] = JSON.parse(row[col]);
                  } catch(e) {}
                }
              });
              return {
                ...parsed,
                ...Object.fromEntries(Object.entries(parsed.head_wise_rates || {}).map(([k, v]) => [`rate_${k}`, v])),
                ...Object.fromEntries(Object.entries(parsed.k_other_earnings || {}).map(([k, v]) => [`k_earning_${k}`, v])),
                ...Object.fromEntries(Object.entries(parsed.k_deductions || {}).map(([k, v]) => [`k_deduction_${k}`, v])),
                ...Object.fromEntries(Object.entries(parsed.p_other_earnings_kp || {}).map(([k, v]) => [`p_earning_${k}`, v])),
                ...Object.fromEntries(Object.entries(parsed.p_deductions || {}).map(([k, v]) => [`p_deduction_${k}`, v])),
                ...Object.fromEntries(Object.entries(parsed.p_ctc_heads || {}).map(([k, v]) => [`p_ctc_head_${k}`, v])),
              };
            });
            res.json(processedRows);
          } catch (e: any) {
            res.status(500).json({ error: e.message });
          
}
};

export const lockFinalPayroll: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { monthYear } = args;
          if (!monthYear) return res.status(400).json({ error: 'monthYear is required' });
          try {
            primaryDb.prepare("UPDATE final_payroll SET status = 'LOCKED' WHERE month_year = ?").run(monthYear);
            statutoryDb.prepare("UPDATE final_payroll SET status = 'LOCKED' WHERE month_year = ?").run(monthYear);
            res.json({ status: 'success' });
          } catch (e: any) {
            res.status(500).json({ error: e.message });
          
}
};
