import { BaseService } from './base.service';
import { Employee } from '../../types';

interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, any>;
  moduleType?: string;
}

interface ListResponse {
  rows: Employee[];
  total: number;
}

export class EmployeeService extends BaseService {
  private static TABLE = 'employees';

  /**
   * Fetch all active employees via master_crud
   */
  static async getEmployees(query: ListQuery): Promise<ListResponse> {
    return this.call<ListResponse>('master_crud', {
      tableName: this.TABLE,
      operation: 'list',
      moduleType: query.moduleType,
      limit: query.pageSize,
      offset: (query.page || 0) * (query.pageSize || 50),
      search: query.search,
      filters: query.filters,
      includeTotal: true,
      _v: Date.now()
    });
  }

  /**
   * Fetch a single employee by ID
   */
  static async getEmployeeById(id: number, moduleType: string): Promise<Employee> {
    const result = await this.call<any>('master_crud', {
      tableName: this.TABLE,
      operation: 'get',
      id,
      moduleType
    });
    return result;
  }

  /**
   * Add a new employee
   */
  static async addEmployee(employee: Partial<Employee>, moduleType: string): Promise<number> {
    return this.call<number>('master_crud', {
      tableName: this.TABLE,
      operation: 'create',
      moduleType,
      data: employee
    });
  }

  /**
   * Update an existing employee
   */
  static async updateEmployee(id: number, employee: Partial<Employee>, moduleType: string): Promise<void> {
    return this.call<void>('master_crud', {
      tableName: this.TABLE,
      operation: 'update',
      id,
      moduleType,
      data: employee
    });
  }
}
