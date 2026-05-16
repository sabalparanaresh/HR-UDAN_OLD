import { PayrollEngineK } from './PayrollEngineK.js';
import { PayrollEngineP } from './PayrollEngineP.js';

export class PayrollEngine {
  static getWorkingDays(wdt: any, monthStr: string) {
    return PayrollEngineK.getWorkingDays(wdt, monthStr);
  }

  static getEffectiveRate(db: any, empId: string | number, month: string, moduleType: 'K' | 'P'): number {
    try {
      const history = db.prepare('SELECT rate FROM salary_rate_history WHERE emp_id = ? AND effective_month <= ? ORDER BY effective_month DESC LIMIT 1').get(empId, month) as any;
      if (history && history.rate) {
          return Number(history.rate);
      }
    } catch(e) { /* ignore */ }

    const emp = db.prepare('SELECT wage_amount, statutory_wage_amount FROM employees WHERE id = ?').get(empId) as any;
    if (!emp) return 0;
    return moduleType === 'K' ? (Number(emp.wage_amount) || 0) : (Number(emp.statutory_wage_amount) || 0);
  }

  static calculateStatutoryAttendance(kNetPayable: number, statRate: number, uniformDays: number): number {
    if (statRate === 0) return 0;
    const att = (kNetPayable / statRate) * uniformDays;
    return Math.min(att, uniformDays); 
  }

  static calculateStatutoryDeductions(emp: any, draftGross: number, earnings: any, salaryHeads: any[], configs: any, monthYear: string) {
    return PayrollEngineP.calculateStatutoryDeductions(emp, draftGross, earnings, salaryHeads, configs, monthYear);
  }

  static calculateStatutoryAdjustment(kNetPayable: number, pGrossWage: number, pf: number, esi: number, pt: number, lwf: number): number {
    return kNetPayable + pf + esi + pt + lwf - pGrossWage;
  }

  static recordGratuityProvision(statutoryDb: any, empId: number | string, month: string, rate: number) {
    try {
        const amt = Math.round((rate * 15) / 26 / 12);
        statutoryDb.prepare(`
          INSERT INTO gratuity_provisions (emp_id, month_year, provision_amount, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(empId, month, amt);
    } catch(e) { }
  }

  static calculateGratuityEligibility(joiningDate: string, employmentType: string, isFteContract: boolean): string {
    const join = new Date(joiningDate);
    if (isNaN(join.getTime())) return '';
    const eligibleDate = new Date(join);
    if (isFteContract || employmentType === 'Fixed-Term') {
      eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);
    } else {
      eligibleDate.setFullYear(eligibleDate.getFullYear() + 5);
    }
    return eligibleDate.toISOString().split('T')[0];
  }
}
