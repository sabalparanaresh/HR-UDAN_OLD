import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';

import AttendanceEntry from '../../pages/transactions/AttendanceEntry';
import SalaryProcessing from '../../pages/transactions/SalaryProcessing';
import FinalPayrollView from '../../pages/transactions/FinalPayrollView';
import AdvanceProcessing from '../../pages/transactions/AdvanceProcessing';
import ArrearEntry from '../../pages/transactions/ArrearEntry';
import LoanApplication from '../../pages/transactions/LoanApplication';
import LeaveCreditEntry from '../../pages/transactions/LeaveCreditEntry';
import GrievanceEntry from '../../pages/transactions/GrievanceEntry';
import BankTransfers from '../../pages/transactions/BankTransfers';
import CanteenEntry from '../../pages/transactions/CanteenEntry';
import AssetDepositTracker from '../../pages/transactions/AssetDepositTracker';
import RokdaManagement from '../../pages/transactions/RokdaManagement';
import CashManagement from '../../pages/transactions/CashManagement';
import DailyMISManagement from '../../pages/transactions/DailyMISManagement';
import EarningEntry from '../../pages/transactions/EarningEntry';
import DeductionEntry from '../../pages/transactions/DeductionEntry';
import ProductionEntry from '../../pages/transactions/ProductionEntry';

export const TransactionsRoutes = (currentUser: User | null) => {
  return (
    <Route path="transactions">
      <Route path="attendance" element={<ProtectedRoute moduleCode="K" pageKey="attendance"><AttendanceEntry currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="salary" element={<ProtectedRoute moduleCode="K" pageKey="salary"><SalaryProcessing currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="final-payroll" element={<ProtectedRoute moduleCode="*" pageKey="finalPayroll"><FinalPayrollView /></ProtectedRoute>} />
      <Route path="arrear-entry" element={<ProtectedRoute moduleCode="*" pageKey="arrearEntry"><ArrearEntry currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="bank-transfers" element={<ProtectedRoute moduleCode="K" pageKey="bankTransfers"><BankTransfers /></ProtectedRoute>} />
      <Route path="advance" element={<ProtectedRoute moduleCode="K" pageKey="advance"><AdvanceProcessing currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="loan-application" element={<ProtectedRoute moduleCode="K" pageKey="loanApplication"><LoanApplication /></ProtectedRoute>} />
      <Route path="leave-credit-entry" element={<ProtectedRoute moduleCode="*" pageKey="leaveCredit"><LeaveCreditEntry /></ProtectedRoute>} />
      <Route path="grievance-entry" element={<ProtectedRoute moduleCode="*" pageKey="grievanceEntry"><GrievanceEntry /></ProtectedRoute>} />
      <Route path="canteen-entry" element={<ProtectedRoute moduleCode="K" pageKey="canteenEntry"><CanteenEntry currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="asset-tracker" element={<ProtectedRoute moduleCode="K" pageKey="assetTracker"><AssetDepositTracker /></ProtectedRoute>} />
      <Route path="rokda-management" element={<ProtectedRoute moduleCode="K" pageKey="rokdaManagement"><RokdaManagement currentUser={currentUser!} onRedirect={() => {}} /></ProtectedRoute>} />
      <Route path="cash-management" element={<ProtectedRoute moduleCode="K" pageKey="cashManagement"><CashManagement /></ProtectedRoute>} />
      <Route path="daily-mis" element={<ProtectedRoute moduleCode="K" pageKey="dailyMis"><DailyMISManagement currentUser={currentUser!} onRedirect={() => {}} /></ProtectedRoute>} />
      <Route path="earning" element={<ProtectedRoute moduleCode="K" pageKey="earningEntry"><EarningEntry currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="deduction" element={<ProtectedRoute moduleCode="K" pageKey="deductionEntry"><DeductionEntry currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="production" element={<ProtectedRoute moduleCode="K" pageKey="productionEntry"><ProductionEntry /></ProtectedRoute>} />
    </Route>
  );
};
