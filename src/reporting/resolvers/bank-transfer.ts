import { ReportResolver, ReportContext, ReportResult } from '../types';

const BankTransferResolver: ReportResolver = {
  resolve: async (context: ReportContext): Promise<ReportResult> => {
    // Placeholder implementation for Bank Transfer Report
    return {
      columns: [
        { key: 'emp_id', label: 'Emp ID' },
        { key: 'name', label: 'Name' },
        { key: 'account_no', label: 'Account No' },
        { key: 'amount', label: 'Amount' }
      ],
      data: []
    };
  }
};

export default BankTransferResolver;
