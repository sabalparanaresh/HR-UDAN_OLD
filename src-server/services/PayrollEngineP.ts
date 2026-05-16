export class PayrollEngineP {
  static calculateStatutoryDeductions(
    emp: any,
    draftGross: number,
    earnings: Record<string, number>,
    salaryHeads: any[],
    configs: { pf: any; esi: any; pt: any; lwf: any },
    monthYear: string
  ) {
    const isPfCovered = emp.is_pf_covered === undefined || emp.is_pf_covered === null || emp.is_pf_covered === 1;
    const isEsiCovered = emp.is_esi_covered === undefined || emp.is_esi_covered === null || emp.is_esi_covered === 1;

    let pf = 0;
    let esi = 0;
    let ptax = 0;
    let lwf = 0;

    const ptGross = draftGross + Object.values(earnings).reduce((a, b) => a + b, 0); 
    
    let totalDeductions = 0;
    const capAtNetPayable = (deduction: number) => {
      const netPayable = ptGross - totalDeductions;
      return Math.min(deduction, Math.max(0, netPayable));
    };

    if (isEsiCovered && configs.esi) {
      const esiGrossHeadsNames = salaryHeads.filter(h => configs.esi.gross_heads?.includes(h.id)).map(h => h.name.toUpperCase());
      let esiGross = draftGross; 
      for (const [name, amt] of Object.entries(earnings)) {
        if (esiGrossHeadsNames.includes(name.toUpperCase())) esiGross += amt;
      }
      esi = this.calculateESI(esiGross, configs.esi, true);
      esi = capAtNetPayable(esi);
      totalDeductions += esi;
    }

    if (isPfCovered && configs.pf) {
      const pfGrossHeadsNames = salaryHeads.filter(h => configs.pf.gross_heads?.includes(h.id)).map(h => h.name.toUpperCase());
      let pfGross = draftGross;
      for (const [name, amt] of Object.entries(earnings)) {
        if (pfGrossHeadsNames.includes(name.toUpperCase())) pfGross += amt;
      }

      const standardPf = this.calculatePF(pfGross, configs.pf, true);
      
      if (emp.voluntary_pf_applicable === 1) {
        const vpfVal = emp.voluntary_pf_value || 0;
        pf = emp.voluntary_pf_type === 'Percentage' ? (pfGross * vpfVal) / 100 : vpfVal;
      } else {
        pf = standardPf;
      }
      
      pf = Math.round(capAtNetPayable(pf));
      totalDeductions += pf;
    }

    if (configs.pt && configs.pt.slabs) {
      let ptAmount = 0;
      for (const slab of configs.pt.slabs) {
        if (ptGross >= slab.from && (slab.to === 0 || ptGross <= slab.to)) {
          ptAmount = slab.amount;
          break;
        }
      }
      ptax = Math.round(capAtNetPayable(ptAmount));
      totalDeductions += ptax;
    }

    if (configs.lwf && configs.lwf.employee_amount) {
      const [year, month] = monthYear.split('-').map(Number);
      const date = new Date(year, month - 1);
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      
      if (!configs.lwf.months || configs.lwf.months.includes(monthName)) {
        lwf = Math.round(capAtNetPayable(configs.lwf.employee_amount));
        totalDeductions += lwf;
      }
    }

    return {
      PF: pf, ESI: esi, PT: ptax, LWF: lwf,
      breakdown: {
        ...(pf > 0 ? { [salaryHeads.find(h => h.system_head === 'PROVIDENT_FUND')?.name || 'PF']: pf } : {}),
        ...(esi > 0 ? { [salaryHeads.find(h => h.system_head === 'ESI')?.name || 'ESI']: esi } : {}),
        ...(ptax > 0 ? { [salaryHeads.find(h => h.system_head === 'PROFESSIONAL_TAX')?.name || 'P.TAX']: ptax } : {}),
        ...(lwf > 0 ? { [salaryHeads.find(h => h.system_head === 'LABOUR_WELFARE_FUND')?.name || 'LWF']: lwf } : {})
      }
    };
  }

  static calculatePF(pfGross: number, config: { ceiling_amount: number; employee_pct: number }, isCovered: boolean = true) {
    if (!isCovered) return 0;
    const ceiling = config.ceiling_amount || 15000;
    const pct = config.employee_pct || 12;
    const base = Math.min(pfGross, ceiling);
    return Math.round((base * pct) / 100);
  }

  static calculateESI(esiGross: number, config: { eligibility_limit: number; employee_pct: number }, isCovered: boolean = true) {
    if (!isCovered) return 0;
    const limit = config.eligibility_limit || 21000;
    const pct = config.employee_pct || 0.75;
    if (esiGross > limit) return 0;
    return Math.ceil((esiGross * pct) / 100);
  }
}
