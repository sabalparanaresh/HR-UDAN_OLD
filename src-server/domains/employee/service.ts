import { EmployeeRepository } from './repository.js';
import { EmployeeSchema } from '../../validation/index.js';
import { Mapper } from '../../utils/mapper.js';
import { mapKeys, toCamelCase } from '../../utils/helpers.js';

export class EmployeeService {
  private primaryRepo: EmployeeRepository;
  private statutoryRepo: EmployeeRepository;

  constructor(primaryDb: any, statutoryDb: any) {
    this.primaryRepo = new EmployeeRepository(primaryDb);
    this.statutoryRepo = new EmployeeRepository(statutoryDb);
  }

  public getList(moduleType: 'K' | 'P', offset: number = 0, limit: number = 50): any[] {
    const repo = moduleType === 'P' ? this.statutoryRepo : this.primaryRepo;
    const type = moduleType === 'P' ? 'STATUTORY' : 'WAGE';
    const rows = repo.findAll(type, limit, offset);
    
    return rows.map((row: any) => {
      const jsonFields = ['components', 'slabs', 'pf_history', 'bank_history', 'esi_history', 'family_members', 'employment_history', 'categories', 'classes', 'groups', 'departments', 'designations'];
      jsonFields.forEach(f => {
        if (row[f] && typeof row[f] === 'string' && (row[f].startsWith('{') || row[f].startsWith('['))) {
          try { row[f] = JSON.parse(row[f]); } catch (e) { }
        }
      });
      return row;
    });
  }

  public getById(id: string | number, moduleType: 'K' | 'P'): any {
    const repo = moduleType === 'P' ? this.statutoryRepo : this.primaryRepo;
    const type = moduleType === 'P' ? 'STATUTORY' : 'WAGE';
    const row = repo.findById(id, type);
    
    if (row) {
      const jsonFields = ['components', 'slabs', 'pf_history', 'bank_history', 'esi_history', 'family_members', 'employment_history', 'categories', 'classes', 'groups', 'departments', 'designations'];
      jsonFields.forEach(f => {
        if (row[f] && typeof row[f] === 'string' && (row[f].startsWith('{') || row[f].startsWith('['))) {
          try { row[f] = JSON.parse(row[f]); } catch (e) { }
        }
      });
    }
    return row;
  }

  public create(data: any, moduleType: 'K' | 'P'): any {
    const repo = moduleType === 'P' ? this.statutoryRepo : this.primaryRepo;
    
    const camelData = mapKeys(data, toCamelCase);
    if (!camelData.empCode && (camelData.employeeCode || camelData['employee code'])) {
      camelData.empCode = camelData.employeeCode || camelData['employee code'];
    }
    
    let processedData;
    try {
        processedData = Mapper.employee.toPersistence(EmployeeSchema.parse(camelData));
        if (processedData.status !== undefined) {
             let s = processedData.status;
             if (typeof s === 'string') s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
             else if (typeof s === 'boolean') s = s ? 1 : 0;
             processedData.status = s;
        }
    } catch(e: any) {
        throw new Error("Validation Failed: " + JSON.stringify(e.errors || e.message));
    }
    
    return repo.create(processedData);
  }

  public update(id: string | number, data: any, moduleType: 'K' | 'P'): any {
    const repo = moduleType === 'P' ? this.statutoryRepo : this.primaryRepo;
    
    const camelData = mapKeys(data, toCamelCase);
    if (!camelData.empCode && (camelData.employeeCode || camelData['employee code'])) {
      camelData.empCode = camelData.employeeCode || camelData['employee code'];
    }
    
    let processedData;
    try {
        processedData = Mapper.employee.toPersistence(EmployeeSchema.partial().parse(camelData) as any);
        if (processedData.status !== undefined) {
             let s = processedData.status;
             if (typeof s === 'string') s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
             else if (typeof s === 'boolean') s = s ? 1 : 0;
             processedData.status = s;
        }
    } catch(e: any) {
        throw new Error("Validation Failed: " + JSON.stringify(e.errors || e.message));
    }
    
    return repo.update(id, processedData);
  }

  public delete(id: string | number, moduleType: 'K' | 'P') {
    const repo = moduleType === 'P' ? this.statutoryRepo : this.primaryRepo;
    return repo.delete(id);
  }
}
