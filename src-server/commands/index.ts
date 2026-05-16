import * as rokda from './rokda.js';
import * as pincode from './pincode.js';
import * as excel from './excel.js';
import * as statutory from './statutory.js';
import * as financials from './financials.js';
import * as banking from './banking.js';
import * as loans from './loans.js';
import * as canteen from './canteen.js';
import bcrypt from 'bcryptjs';
import { CommandHandler } from './types.js';
import * as general from './general.js';
import * as payroll from './payroll.js';
import * as employee from './employee.js';
import * as attendance from './attendance.js';
import * as masterData from './masterData.js';
import * as crud from './crud.js';
import * as config from './config.js';
import * as reports from './reports.js';

export const COMMAND_MAP: Record<string, CommandHandler> = {
  // Statutory
  'get_statutory_settings': statutory.getStatutorySettings,
  'list_statutory_settings': statutory.listStatutorySettings,
  'save_statutory_settings': statutory.saveStatutorySettings,
  'delete_statutory_setting': statutory.deleteStatutorySetting,
  'calculate_ptax': statutory.calculatePtax,
  'get_gratuity_ledger': statutory.getGratuityLedger,
  'sync_salary_slabs_to_p': statutory.syncSalarySlabsToP,

  // General
  'verify_security_key': general.verifySecurityKey,
  'handle_login': general.handleLogin,
  'user_crud': general.userCrud,
  'update_connection_status': general.updateConnectionStatus,
  'get_connection_status': general.getConnectionStatus,
  'get_last_sync_timestamp': general.getLastSyncTimestamp,
  'get_company_config': config.getCompanyConfig,
  'save_company_config': config.saveCompanyConfig,
  'piece_rate_crud': crud.pieceRateCrud,
  'get_bank_excel_configs': banking.getBankExcelConfigs,
  'save_bank_excel_config': banking.saveBankExcelConfig,
  'delete_bank_excel_config': banking.deleteBankExcelConfig,
  'reserve_bank_reference_numbers': banking.reserveBankReferenceNumbers,
  'generate_bank_excel': banking.generateBankExcel,
  'get_processed_salary_for_bank': banking.getProcessedSalaryForBank,
  'get_cash_transactions': financials.getCashTransactions,
  'get_canteen_master_data': canteen.getCanteenMasterData,
  'get_canteen_transactions': canteen.getCanteenTransactions,
  'get_attendance_logs': attendance.getAttendanceLogs,
  'export_final_payroll': payroll.exportFinalPayroll,
  'handle_reset_password': (ctx, args) => {
    const { primaryDb, res } = ctx;
    const username = args.username || args.resetUsername;
    const new_password = args.new_password || args.newPassword || args.resetNewPassword;
    if (!username || !new_password) return res.status(400).json({ error: 'Username and new password are required' });
    bcrypt.hash(new_password, 10).then((hash: string) => {
       const result = primaryDb.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, username);
       if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
       res.json({ status: 'success' });
    });
  },
  
  // Payroll
  'get_paginated_salary_results': payroll.getPaginatedSalaryResults,
  'calculate_payroll_draft': payroll.calculatePayrollDraft,
  'calculate_k_module_wages': payroll.calculateKModuleWages,
  'calculate_p_module_statutory': payroll.calculatePModuleStatutory,
  'consolidate_final_payroll': payroll.consolidateFinalPayroll,
  'commit_payroll': payroll.commitPayroll,
  'update_payroll_status': payroll.updatePayrollStatus,
  'get_processed_payroll': payroll.getProcessedPayroll,

  // Employee
  'get_leave_credit_preview': employee.getLeaveCreditPreview,
  'post_leave_credits': employee.postLeaveCredits,
  'save_employee_asset': employee.saveEmployeeAsset,
  'check_duplicate': employee.checkDuplicate,
  'bulk_employee_upsert': employee.bulkEmployeeUpsert,
  'record_salary_revision': employee.recordSalaryRevision,
  'get_salary_revision_history': employee.getSalaryRevisionHistory,
  'get_open_grievances': employee.getOpenGrievances,
  'resolve_grievance': employee.resolveGrievance,
  'search_employees': employee.searchEmployees,
  'sync_employee_to_pakka': employee.syncEmployeeToPakka,

  // Attendance
  'fetch_biometric_logs': attendance.fetchBiometricLogs,
  'available_biometric_readers': attendance.availableBiometricReaders,
  'check_biometric_connection': attendance.checkBiometricConnection,
  'generate_ghost_punches': attendance.generateGhostPunches,
  'process_attendance': attendance.processAttendance,
  'bulk_attendance_v2': attendance.bulkAttendanceV2,

  // Master Data
  'get_master_data': masterData.getMasterData,
  'get_pincode_records': masterData.getPincodeRecords,
  'bulk_bank_import': masterData.bulkBankImport,
  'bulk_pincode_upsert': masterData.bulkPincodeUpsert,
  'get_ogd_records': masterData.getOgdRecords,
  'get_ogd_bank_list': masterData.getOgdBankList,
  'get_ogd_bank_branches': masterData.getOgdBankBranches,
  'bulk_upload_departments': masterData.bulkUploadDepartments,
  'bulk_upload_standard_rates': masterData.bulkUploadStandardRates,
  'clear_org_data': masterData.clearOrgData,
  'save_rokda_voucher': masterData.saveRokdaVoucher,

  // CRUD
  'master_crud': masterData.masterCrud,
  'transaction_crud': crud.transactionCrud,
  'save_daily_mis_batch': crud.saveDailyMisBatch,
  'get_transaction_history': crud.getTransactionHistory,
  'update_transaction': crud.updateTransaction,
  'bulk_delete_transactions': crud.bulkDeleteTransactions,

  // Reports
  'get_report_definition': reports.getReportDefinition,
  'get_analytic_data': reports.getAnalyticData,
  'sync_k_to_p': reports.syncKToP,
  'get_attendance_analytics': reports.getAttendanceAnalytics,
  'get_payroll_analytics': reports.getPayrollAnalytics,
  'get_audit_analytics': reports.getAuditAnalytics,
  'get_compliance_analytics': reports.getComplianceAnalytics,
  'get_dashboard_data': reports.getDashboardData,
  'get_report_schedules': reports.getReportSchedules,
  'create_report_schedule': reports.createReportSchedule,
  'delete_report_schedule': reports.deleteReportSchedule,
  'toggle_report_schedule': reports.toggleReportSchedule,
  'get_report_schedule_history': reports.getReportScheduleHistory,
  'get_report_templates': reports.getReportTemplates,
  'save_report_template': reports.saveReportTemplate,
  'delete_report_template': reports.deleteReportTemplate,
  'execute_kpi_query': reports.executeKpiQuery,
  'execute_report_query': reports.executeReportQuery,
  'save_report_snapshot': reports.saveReportSnapshot,
  'get_report_snapshots': reports.getReportSnapshots,
  'get_report_snapshot_data': reports.getReportSnapshotData,
};
