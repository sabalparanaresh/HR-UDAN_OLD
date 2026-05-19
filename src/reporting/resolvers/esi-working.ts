import { ReportResolver, ReportContext, ReportResult } from '../types';

const EsiWorkingResolver: ReportResolver = {
  resolve: async (context: ReportContext): Promise<ReportResult> => {
    // Placeholder implementation for ESI Working Report
    return {
      columns: [
        { key: 'emp_id', label: 'Emp ID' },
        { key: 'name', label: 'Name' },
        { key: 'esi_no', label: 'ESI No' },
        { key: 'employee_share', label: 'Employee Share' },
        { key: 'employer_share', label: 'Employer Share' }
      ],
      data: []
    };
  }
};

export default EsiWorkingResolver;
