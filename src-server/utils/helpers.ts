export function toSnakeCase(str: string): string {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_');
}

export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
    .trim();
}

export function mapKeys(obj: any, fn: (key: string) => string): any {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[fn(key)] = obj[key];
  }
  return result;
}

export function sanitizeData(val: any): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return null;
    return val;
  }
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return val;
}

export function calculateBifurcation(gross: number, components: any[], allHeads: any[]) {
  const bifurcation: Record<string, number> = {};
  let totalCalculated = 0;

  // Track components that need to be calculated later (like RESIDUAL or PERCENT_HEAD if parent isn't ready)
  const pending: any[] = [];
  const compMap: Record<number, any> = {};

  for (const comp of components) {
    const headId = comp.head_id || comp.salary_head_id;
    const head = allHeads.find(h => h.id === headId || h.name === comp.head_name);
    if (!head) continue;
    
    compMap[head.id] = head.name;
    const type = comp.type || comp.calculation_type;

    let amount = 0;
    if (type === 'FIXED') {
      amount = comp.value || 0;
      bifurcation[head.name] = amount;
      totalCalculated += amount;
    } else if (type === 'PERCENTAGE' || type === 'PERCENT_CTC') {
      const baseName = comp.base_head_name || 'GROSS';
      if (baseName === 'GROSS') {
        amount = (gross * (comp.value || 0)) / 100;
        bifurcation[head.name] = amount;
        totalCalculated += amount;
      }
    } else if (type === 'PERCENT_HEAD') {
       pending.push({ ...comp, headName: head.name });
    } else if (type === 'RESIDUAL') {
       pending.push({ ...comp, headName: head.name, isResidual: true });
    }
  }

  // Second pass for dependent calculations
  for (const comp of pending) {
    if (comp.isResidual) continue; // handle last
    const parentName = compMap[comp.parent_head_id] || comp.base_head_name;
    if (parentName && bifurcation[parentName] !== undefined) {
       const amount = (bifurcation[parentName] * (comp.value || 0)) / 100;
       bifurcation[comp.headName] = amount;
       totalCalculated += amount;
    }
  }

  // Third pass: RESIDUAL
  const residualComp = pending.find(p => p.isResidual);
  if (residualComp) {
    if (gross > totalCalculated) {
      bifurcation[residualComp.headName] = gross - totalCalculated;
      totalCalculated = gross;
    } else {
      bifurcation[residualComp.headName] = 0;
    }
  }

  // Handle residual Adjustment if any
  if (gross > totalCalculated) {
    bifurcation['Adjustment'] = (bifurcation['Adjustment'] || 0) + (gross - totalCalculated);
  }

  return bifurcation;
}

export function mapBifurcationToColumns(bifurcation: Record<string, number>) {
  const cols: Record<string, number> = {};
  for (const [name, amount] of Object.entries(bifurcation)) {
    const colName = toSnakeCase(name.replace(/\s+/g, '_'));
    cols[colName] = amount;
  }
  return cols;
}

export function isKConnected(primaryDb: any): boolean {
  const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
  return status?.value !== 'DISCONNECTED';
}
