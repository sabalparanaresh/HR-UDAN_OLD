// P Module Statutory Engine

export interface StatutoryConfig {
  basicWage: number;       // e.g., Basic Salary per month
  statRate: number;        // e.g., Basic + DA + Conveyance
  uniformDays: number;     // e.g., 30 (statutory days per month)
  maxAttendanceValue: number; // For capping P attendance if K hits higher (like OT)
  isPfCovered: boolean;
  isEsiCovered: boolean;
  pfCeiling: number;       // usually 15000
  pfPct: number;           // usually 12%
  esiLimit: number;        // usually 21000
  esiPct: number;          // usually 0.75%
}

export interface PEarningsDeductions {
  earningsKP: { name: string; amount: number }[];
  deductionsKP: { name: string; amount: number }[];
}

export interface PModuleOutput {
  pAttendance: number;
  pGrossWage: number;
  basicEarned: number;
  pfAmount: number;
  esiAmount: number;
  kpEarningsTotal: number;
  kpDeductionsTotal: number;
  adjustment: number;
  pGrossStatutoryPayable: number;
  pTotalDeductions: number;
  pNetPayable: number; // Should exactly match kNetPayable
}

export function calculatePModule(
  targetNetPayable: number,
  config: StatutoryConfig,
  transactions: PEarningsDeductions
): PModuleOutput {
  
  // 1. Derive Reverse Attendance from Target Net (approximate)
  let pAttendance = 0;
  if (config.statRate > 0 && config.uniformDays > 0) {
    pAttendance = targetNetPayable / (config.statRate / config.uniformDays);
    pAttendance = Math.floor(pAttendance);
  }
  
  // Cap at max (either K attendance or Uniform Days depending on logic)
  if (config.maxAttendanceValue !== undefined && config.maxAttendanceValue !== null && config.maxAttendanceValue > 0) {
    pAttendance = Math.min(pAttendance, config.maxAttendanceValue);
  } else {
    pAttendance = Math.min(pAttendance, config.uniformDays || 30);
  }

  // 2. Compute Earnings/Deductions Totals from KP Heads
  let kpEarningsTotal = 0;
  for (const t of transactions.earningsKP) {
    kpEarningsTotal += t.amount;
  }

  let kpDeductionsTotal = 0;
  for (const t of transactions.deductionsKP) {
    kpDeductionsTotal += t.amount;
  }

  // 3. Gross Computations
  const pGrossWage = Math.round((config.statRate / config.uniformDays) * pAttendance);
  const basicEarned = config.basicWage > 0 
    ? Math.round((config.basicWage / config.uniformDays) * pAttendance) 
    : pGrossWage;

  // 4. Statutory Caps (PF & ESI)
  let pfAmount = 0;
  if (config.isPfCovered) {
    const pfBase = Math.min(basicEarned, config.pfCeiling || 15000);
    pfAmount = Math.round((pfBase * config.pfPct) / 100);
  }

  let esiAmount = 0;
  if (config.isEsiCovered) {
    if (pGrossWage <= (config.esiLimit || 21000)) {
      esiAmount = Math.ceil((pGrossWage * config.esiPct) / 100);
    }
  }

  // 5. Deductions & Adjustment to match target K Net
  const pTotalDeductionsFixed = pfAmount + esiAmount + kpDeductionsTotal;
  
  // To meet target => pNetPayable = pGrossStatutoryPayable - pTotalDeductions
  // pGrossStatutoryPayable = pGrossWage + adjustment + kpEarningsTotal
  // adjustment = targetNetPayable + pTotalDeductionsFixed - pGrossWage - kpEarningsTotal
  const adjustment = Math.round(targetNetPayable + pTotalDeductionsFixed - pGrossWage - kpEarningsTotal);
  
  const pGrossStatutoryPayable = pGrossWage + adjustment + kpEarningsTotal;
  const pTotalDeductions = pTotalDeductionsFixed;
  const pNetPayable = pGrossStatutoryPayable - pTotalDeductions;

  return {
    pAttendance,
    pGrossWage,
    basicEarned,
    pfAmount,
    esiAmount,
    kpEarningsTotal,
    kpDeductionsTotal,
    adjustment,
    pGrossStatutoryPayable,
    pTotalDeductions,
    pNetPayable
  };
}
