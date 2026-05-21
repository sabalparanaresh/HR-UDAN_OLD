import { PSalaryDetailsDTO, PSalaryHeadConfigDTO } from '../../../types/pSalaryDetails';

export const pSalaryFieldAdapter = {
  toFormData: (dto: PSalaryDetailsDTO | null): any => {
    if (!dto) {
      return {
        effective_from: new Date().toISOString().split('T')[0],
        statutory_working_day_type: '',
        statutory_wage_type: '',
        statutory_base_rate: 0,
        heads: {}
      };
    }
    
    let heads = {};
    try {
      heads = JSON.parse(dto.salary_head_json || '{}');
    } catch (e) {}

    return {
      id: dto.id,
      effective_from: dto.effective_from,
      statutory_working_day_type: dto.statutory_working_day_type,
      statutory_wage_type: dto.statutory_wage_type,
      statutory_base_rate: dto.statutory_base_rate,
      heads
    };
  },

  toDTO: (employeeId: number, formData: any): PSalaryDetailsDTO => {
    return {
      id: formData.id,
      employee_id: employeeId,
      effective_from: formData.effective_from,
      statutory_working_day_type: formData.statutory_working_day_type,
      statutory_wage_type: formData.statutory_wage_type,
      statutory_base_rate: Number(formData.statutory_base_rate) || 0,
      salary_head_json: JSON.stringify(formData.heads || {})
    };
  }
};
