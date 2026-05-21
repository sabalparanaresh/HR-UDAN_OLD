import { BaseService } from './base.service';
import { Employee } from '../../types';
import { fetchApi } from '../apiClient';

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
    const params = new URLSearchParams();
    if (query.moduleType) params.append('module_type', query.moduleType);
    if (query.pageSize) params.append('limit', String(query.pageSize));
    if (query.page) params.append('offset', String(query.page * (query.pageSize || 50)));
    if (query.search) params.append('search', query.search);
    // Note: filters omitted for brevity in REST query, but could be passed as JSON param
    if (query.filters) params.append('filters', JSON.stringify(query.filters));
    
    return fetchApi<ListResponse>(`/api/master-data/${this.TABLE}?${params.toString()}`);
  }

  static async getEmployeeById(id: number, moduleType: string): Promise<Employee> {
    return fetchApi<any>(`/api/master-data/${this.TABLE}/${id}?module_type=${moduleType}`);
  }

  static async addEmployee(employee: Partial<Employee>, moduleType: string): Promise<number> {
    return fetchApi<number>(`/api/master-data/${this.TABLE}`, {
      method: 'POST',
      body: JSON.stringify({ ...employee, module_type: moduleType })
    });
  }

  static async updateEmployee(id: number, employee: Partial<Employee>, moduleType: string): Promise<void> {
    return fetchApi<void>(`/api/master-data/${this.TABLE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...employee, module_type: moduleType })
    });
  }
}
