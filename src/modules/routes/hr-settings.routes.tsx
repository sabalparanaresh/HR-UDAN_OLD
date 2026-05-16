import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';

import PieceRateConfig from '../../pages/hr-settings/PieceRateConfig';
import CompanySettings from '../../pages/hr-settings/CompanySettings';
import BankMaster from '../../pages/hr-settings/BankMaster';
import PincodeMaster from '../../pages/hr-settings/PincodeMaster';
import WeeklyOffSettings from '../../pages/hr-settings/WeeklyOffSettings';
import WorkingDayTypes from '../../pages/hr-settings/WorkingDayTypes';
import ShiftSettings from '../../pages/hr-settings/ShiftSettings';
import SalaryHeads from '../../pages/hr-settings/SalaryHeads';
import SalarySlabManager from '../../pages/hr-settings/SalarySlabManager';
import StatutorySettings from '../../pages/hr-settings/StatutorySettings';
import ClassCategoryMaster from '../../pages/hr-settings/ClassCategoryMaster';
import LocationDivisionMaster from '../../pages/hr-settings/LocationDivisionMaster';
import GroupDepartmentMaster from '../../pages/hr-settings/GroupDepartmentMaster';
import DesignationMaster from '../../pages/hr-settings/DesignationMaster';
import HolidayMaster from '../../pages/hr-settings/HolidayMaster';
import LeaveSettings from '../../pages/hr-settings/LeaveSettings';
import LoanTypes from '../../pages/hr-settings/LoanTypes';
import GrievanceSettings from '../../pages/hr-settings/GrievanceSettings';
import CanteenSettings from '../../pages/hr-settings/CanteenSettings';

export const HrSettingsRoutes = (currentUser: User | null) => {
  return (
    <Route path="hr-settings">
      <Route path="piece-rate" element={<ProtectedRoute moduleCode="K" pageKey="settings"><PieceRateConfig /></ProtectedRoute>} />
      <Route path="company" element={<ProtectedRoute moduleCode="K" pageKey="settings"><CompanySettings currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="bank-master" element={<ProtectedRoute moduleCode="*" pageKey="bankMaster"><BankMaster /></ProtectedRoute>} />
      <Route path="pincode-master" element={<ProtectedRoute moduleCode="*" pageKey="pincodeMaster"><PincodeMaster /></ProtectedRoute>} />
      <Route path="weekly-off" element={<ProtectedRoute moduleCode="*" pageKey="weeklyOff"><WeeklyOffSettings /></ProtectedRoute>} />
      <Route path="day-types" element={<ProtectedRoute moduleCode="*" pageKey="dayTypes"><WorkingDayTypes /></ProtectedRoute>} />
      <Route path="shifts" element={<ProtectedRoute moduleCode="*" pageKey="shifts"><ShiftSettings /></ProtectedRoute>} />
      <Route path="salary-heads" element={<ProtectedRoute moduleCode="*" pageKey="salaryHeads"><SalaryHeads /></ProtectedRoute>} />
      <Route path="salary-slabs" element={<ProtectedRoute moduleCode="*" pageKey="salarySlabs"><SalarySlabManager /></ProtectedRoute>} />
      <Route path="statutory-settings" element={<ProtectedRoute moduleCode="*" pageKey="statutorySettings"><StatutorySettings /></ProtectedRoute>} />
      <Route path="class-category" element={<ProtectedRoute moduleCode="*" pageKey="classCategory"><ClassCategoryMaster /></ProtectedRoute>} />
      <Route path="location-division" element={<ProtectedRoute moduleCode="*" pageKey="locationDivision"><LocationDivisionMaster /></ProtectedRoute>} />
      <Route path="group-department" element={<ProtectedRoute moduleCode="*" pageKey="groupDepartment"><GroupDepartmentMaster /></ProtectedRoute>} />
      <Route path="designations" element={<ProtectedRoute moduleCode="*" pageKey="designations"><DesignationMaster /></ProtectedRoute>} />
      <Route path="holidays" element={<ProtectedRoute moduleCode="*" pageKey="holidays"><HolidayMaster /></ProtectedRoute>} />
      <Route path="leave-settings" element={<ProtectedRoute moduleCode="*" pageKey="leaveSettings"><LeaveSettings /></ProtectedRoute>} />
      <Route path="loan-types" element={<ProtectedRoute moduleCode="*" pageKey="loanTypes"><LoanTypes /></ProtectedRoute>} />
      <Route path="grievance-settings" element={<ProtectedRoute moduleCode="*" pageKey="grievanceSettings"><GrievanceSettings /></ProtectedRoute>} />
      <Route path="canteen-settings" element={<ProtectedRoute moduleCode="*" pageKey="canteenSettings"><CanteenSettings currentUser={currentUser!} /></ProtectedRoute>} />
    </Route>
  );
};
