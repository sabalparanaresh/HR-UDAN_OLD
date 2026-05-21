// K Module Payroll Engine

export interface KWageConfig {
  wageType: string; // 'Daily', 'Piece-rate', 'Monthly'
  wageRate: number;
  divisor: number;
}

export interface KEarningsDeductions {
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
}

export interface KModuleOutput {
  kGrossWage: number;
  kOtherEarningsTotal: number;
  kDeductionsTotal: number;
  kNetPayable: number;
  kGrossPayable: number;
}

export function calculateKModule(
  wageConfig: KWageConfig,
  kAttendance: number, // or piece count if Piece-rate
  transactions: KEarningsDeductions
): KModuleOutput {
  let kGrossWage = 0;

  if (wageConfig.wageType === 'Daily') {
    kGrossWage = wageConfig.wageRate * kAttendance;
  } else if (wageConfig.wageType === 'Piece-rate') {
    kGrossWage = wageConfig.wageRate * kAttendance; // kAttendance represents piece count here
  } else if (wageConfig.wageType === 'Monthly') {
    kGrossWage = (wageConfig.wageRate / wageConfig.divisor) * kAttendance;
  } else {
    // Default fallback to Monthly logic
    kGrossWage = (wageConfig.wageRate / wageConfig.divisor) * kAttendance;
  }

  let kOtherEarningsTotal = 0;
  for (const t of transactions.earnings) {
    kOtherEarningsTotal += t.amount;
  }

  let kDeductionsTotal = 0;
  for (const t of transactions.deductions) {
    kDeductionsTotal += t.amount;
  }

  const kGrossPayable = kGrossWage + kOtherEarningsTotal;
  const kNetPayable = kGrossPayable - kDeductionsTotal;

  return {
    kGrossWage,
    kOtherEarningsTotal,
    kDeductionsTotal,
    kGrossPayable,
    kNetPayable
  };
}
