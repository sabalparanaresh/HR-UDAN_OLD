import { Database } from 'better-sqlite3';
import { formulaEngine } from '../../src/utils/calculation/FormulaEngine.js';

export class PayrollEngineK {
  static getWorkingDays(wdt: any, monthStr: string): { divisor: number, configStr: string } {
    const fallbackName = wdt?.mode || 'DEFAULT';
    if (!wdt) return { divisor: 30, configStr: 'DEFAULT (30)' };
    
    const name = wdt.name || fallbackName;

    if (wdt.mode === 'FIXED') {
      const d = wdt.fixed_days || 30;
      return { divisor: d, configStr: `${name} (${d})` };
    }
    
    const [year, m] = monthStr.split('-').map(Number);
    const monthDays = new Date(year, m, 0).getDate();
    
    if (wdt.mode === 'MONTHLY_DAYS') {
      return { divisor: monthDays, configStr: `${name} (${monthDays})` };
    }

    if (wdt.mode === 'FORMULA' && wdt.formula) {
      let f = wdt.formula;
      f = f.replace(/{MONTH_DAYS}/g, monthDays.toString());
      f = f.replace(/{MONTH_INDEX}/g, m.toString());
      f = f.replace(/{HOLIDAYS}/g, '0');

      if (f.includes('{WEEK_OFFS}')) {
          let sundays = 0;
          for(let i=1; i<=monthDays; i++) {
            if(new Date(year, m-1, i).getDay() === 0) sundays++;
          }
          f = f.replace(/{WEEK_OFFS}/g, sundays.toString());
      }
      
      try {
        const result = formulaEngine.evaluate(f, { MONTH_INDEX: m });
        const divisor = result || monthDays;
        return { divisor, configStr: `${name} (${divisor})` };
      } catch (e) {
        return { divisor: monthDays, configStr: `${name} (ERR: ${monthDays})` };
      }
    }
    
    return { divisor: monthDays, configStr: `${name} (${monthDays})` };
  }
}
