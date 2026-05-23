Part A to Part B CONVERSION
Salary Processing & Statutory Compliance Explainer
1. EXECUTIVE SUMMARY
This document explains the dual-salary model in the HRMS system:
• Part A (Kachha): Actual in-hand wages paid to employees
• Part B (Pakka): Statutory salary for government compliance
The system maintains two parallel salary calculations for accurate payroll operations and statutory compliance.
2. UNDERSTANDING THE DUAL SALARY MODEL
2.1 What is Kachha (Part A)?
Kachha salary (Part A) is the actual, real-time salary that employees receive, based on:
• Actual working days present (K_Present)
• Actual attendance records
• Daily wages, piece rates, hourly rates, or fixed components
• Real earnings (production allowances, incentives, overtime)
• Actual deductions (loans, advances, employee-specific cuts)
Why Kachha Matters: This is what employees actually earn and receive in their bank accounts or cash.
2.2 What is Pakka (Part B)?
Pakka salary (Part B) is the statutory salary for government compliance:
• Standardized working days (26 days per month or defined by user)
• Salary components recognized by labor laws
• Form 16 (Income Tax) base
• Provident Fund (PF) contribution base
• Employee State Insurance (ESI) base
Why Pakka Matters: Required by government for income tax returns, PF transfers, ESI records, and labor law compliance.
3. WORKING DAYS CALCULATION IN PART A
3.1 K_Present Field (Actual Working Days)
K_Present represents the actual number of days an employee was present/worked during the salary period.
Examples:
• Employee A: K_Present = 25 days (worked 25 days in February 2026)
• Employee B: K_Present = 22 days (absent 4 days, 2 days leave)
• Employee C: K_Present = 26 days (full month attendance)
These actual working days are used to calculate daily wage-based earnings.
3.2 Working Days in Statutory Salary (Part B)
For statutory compliance, the working days are standardized:
• Monthly: 26 working days (standard)
• Statutory leave: 1 day per month (paid)
• Holidays: Excluded from working days
• Exception: Actual present days lower if employee took unpaid leave
• P_Present field: Used for statutory salary calculations
4. SALARY TYPES & CALCULATION METHODS
Our system supports multiple salary types for textile mill employees:
4.1 MONTHLY SALARY (Wage_Monthly)
Applied to: Staff, supervisors, permanent employees on Monthly pay
Calculation:
• Monthly Fixed Amount (e.g., ₹50,000)
• Pro-rata deduction if absent: (Absent Days / 26) × Monthly Fixed Amount
• Formula: Monthly Fixed Salary × (Actual Days Present / 26)
Example: Monthly Fixed salary = ₹50,000, Present = 20 days
Part A = ₹50,000 × (20/26) = ₹38,462
4.2 DAILY WAGE (Wage_Daily)
Applied to: Contract workers, temporary staff, daily wage laborers
Calculation:
• Daily Rate (e.g., ₹500 per day)
• Formula: Daily Rate × K_Present
• Only wages for days worked are paid
Example: Daily Rate = ₹500, Present = 22 days
Part A = ₹500 × 22 = ₹11,000
4.3 HOURLY WAGE (Wage_Hourly)
Applied to: Shift workers with flexible hours or overtime-based pay
Calculation:
• Hourly Rate (e.g., ₹100 per hour)
• Formula: Hourly Rate × Total Hours Worked
Example: Hourly Rate = ₹100, Hours = 200/month
Part A = ₹100 × 200 = ₹20,000
4.5 PIECE RATE / QUANTITY-BASED (Wage_Quantity)
Applied to: Production workers paid per unit produced (meters, rolls, etc.)
Calculation:
• Unit Rate (e.g., ₹5 per meter)
• Formula: Unit Rate × Total Units Produced
• Tracked from production records
Example: Unit Rate = ₹5/meter, Production = 3,000 meters
Part A = ₹5 × 3,000 = ₹15,000
5. PART A (KACHHA) EARNINGS CALCULATION
Total Earning (Part A) = Base Wages + Additional Earnings
5.1 Additional Earnings Components:
• EXTRA EARNING: Ad-hoc bonuses or incentives
• REPLACEMENT: Payment for workload beyond standard
• PERF. ALLOW.: Performance allowance based on KPIs
• PROD. ALLOW.: Production allowance tied to output
• MISC. ALLOW.: Other allowances not elsewhere classified
• INCENTIVE: Performance or productivity incentives
• EDU. WELFARE: Educational allowance or welfare benefits
• MEDICAL WELFARE: Medical allowance or healthcare
• ARREAR: Payment of past dues or salary adjustments
• HRA OTHERS: House Rent Allowance or similar
• GRATUITY: Gratuity advance or settlements
• PAID LEAVE: Payment for encashed/paid leave
• EMPL. WELFARE: Employee welfare fund contributions
6. PART A (KACHHA) DEDUCTIONS
Total Deduction = Statutory + Non-Statutory Deductions
6.1 Statutory Deductions (Mandatory by law):
• PF (Provident Fund): 12% of salary, employee share
• ESI (Employee State Insurance): If salary < ₹21,000/month; ~0.75%
• P.TAX (Professional Tax): State-specific; ₹0–₹200/month
• TDS (Tax Deducted at Source): Monthly deduction per annual earnings
6.2 Non-Statutory Deductions:
• LOAN Deduction: Monthly installment on employee loans
• ADVANCE Recovery: Salary advances being recovered
• FOOD: Canteen or food charges
• MEDICAL: Health insurance premiums
• UNIFORM: Cost of uniform or safety gear
• PENALTY: Disciplinary fines or violations
• WORK DIFF: Work-related deductions
7. PART A TO PART B CONVERSION PROCESS
7.1 Why Conversion is Needed:
Part A shows actual wages paid, but statutory requirements demand standardized salary structure for compliance. Part B provides that standardized view.
7.2 Conversion Methodology:
• Identify employee's salary type (Fixed, Daily, Attendance, Hourly, Piece-rate)
• Normalize salary to 26-day month basis (standard statutory working days)
• Recalculate earnings based on P_Present (standardized working days)
• Apply statutory deductions based on normalized salary
• Output standardized structure for Form 16, PF, ESI, and tax purposes
7.3 Conversion Example (Daily Wage Employee):
Scenario: Daily wage worker, K_Present = 22 days (actual)
Parameter	Part A (Actual)	Part B (Statutory)
Working Days	K_Present = 22	P_Present = 26
Daily Rate	₹500/day	₹500/day
Base Earnings	₹500 × 22 = ₹11,000	₹500 × 26 = ₹13,000
Additional Earnings	₹2,000	₹2,000
Total Earning	₹13,000	₹15,000
PF (12%)	₹1,560	₹1,800
PT / Tax	₹200	₹200
Total Deduction	₹1,760	₹2,000
Net Salary (In-Hand)	₹11,240	₹13,000
Key Insight: Part A (₹11,240) is actual salary for 22 days worked. Part B (₹13,000) is statutory salary for 26 days, used for compliance and tax purposes.
8. SYSTEM FIELDS MAPPING (PART A COLUMNS)
Column Name	Purpose
K_Present	Actual working days present for salary month
Wage_Attendance	Base wage for attendance-based salary type
Wage_Daily	Base wage for daily wage salary type
Wage_Fix	Base wage for fixed salary type
Wage_Hourly	Hourly rate for hourly wage salary type
Wage_Quantity	Piece rate for quantity-based salary type
TotalEarning	Sum of all earnings (base + allowances + incentives)
TotalDeduction	Sum of all deductions (PF, ESI, PT, TDS, loans, etc.)
BANK SALARY	Net amount credited to employee bank account
CASH SALARY	Net amount given in cash to employee (if applicable)

9. COMMON SCENARIOS & EXAMPLES
Scenario 1: Employee on Paid Leave (Fixed Salary)
• Fixed Salary: ₹40,000/month
• K_Present: 20 days (took 6 days leave)
• Part A: ₹40,000 × (20/26) = ₹30,769 (pro-rata)
• Part B: ₹40,000 (statutory; leave is paid per policy)
Scenario 2: Daily Wage Worker with Incentive
• Daily Rate: ₹600
• K_Present: 24 days
• Base Wage: ₹600 × 24 = ₹14,400
• Production Incentive: ₹3,000
• Part A Total: ₹17,400
• Part B Total: ₹17,400 (days align with statutory minimum)
Scenario 3: Piece-Rate Worker
• Rate: ₹5 per meter of fabric
• Production: 3,500 meters in 25 days worked
• Part A: ₹5 × 3,500 = ₹17,500
• K_Present: 25 days
• Part B: ₹17,500 × (26/25) = ₹18,200 (normalized)
10. COMPLIANCE & REGULATORY REQUIREMENTS
• PF Compliance: Part B used for contribution calculations and Form 12A
• Income Tax: Part B used for Form 16 generation and TDS
• ESI: Part B determines ESI applicability (if < ₹21,000) and rates
• PT (Professional Tax): State-specific deduction based on Part B
• Statutory Registers: Part A in wage registers; Part B in compliance docs
• Internal Audit: Monthly reconciliation between Part A (actual) and Part B
11. KEY AUDIT POINTS
• Part A Validation: Verify K_Present ≤ calendar days in month
• Wage Calculation: All calculations are formula-driven (no hardcoded values)
• Deduction Validation: PF capped at 12%, ESI per law, PT per state
• Reconciliation: Bank salary + Cash salary = Total In-Hand
• Variance Tracking: Part A vs Part B differences in 'Diff' column
• Change Log: All adjustments recorded with timestamp and user
• Form 16 Alignment: Part B salary matches Form 16 declaration
• PF/ESI Submission: Part B salary used for government compliance
12. FORMULA REFERENCE (APPENDIX)
Fixed Salary (Part A):
= Monthly Fixed Salary × (K_Present / 26)
Daily Wage (Part A):
= Daily Rate × K_Present
Piece-Rate (Part A):
= Rate per Unit × Total Units Produced
Net Salary:
= Total Earnings - Total Deductions
PF Deduction:
= (Applicable Salary / 100) × 12%

13. COMPONENT RULES
- Select Overrides: Never use standard select for employee, default to EmployeeSearchSelect.
- Searchable Selects: EmployeeSearchSelect prioritizes exact match by emp_code on backend and enables rapid Type->Tab->Proceed workflow via nextFieldRef.

14. ARCHITECTURE & FOUNDATIONAL RULES (AUDIT COMPLIANCE)
- Dual Module Isolation: Mandatory strict separation.
  - Module K (Primary): The operational engine. Source of truth for "Actuals".
  - Module P (Statutory): The compliance engine. Source of truth for "Compliance".
- Separate Processing: K Module and P Module each maintain completely separate database files (primary.db and statutory.db), logic, APIs, and state stores. Never mix them.
- Offline-First: All features must work without an internet connection using local SQLite/DuckDB.
- RBAC Enforcement: Role-Based Access Control is enforced on every component. Auditor role is strictly isolated to P Module and read-only (except for audit amendments).
- Audit Mode / Circuit Breaker (Alt+Shift+K): When activated, K is disconnected. P Module must function as a standalone entity using its own cached records.
- Cross-Module Dependencies: K-to-P sync sends RAW DATA ONLY. K Module depends on P Module for compliance reports. When disconnected, K reports use cached P snapshots and display a prominent warning banner.

15. SERVER ARCHITECTURE (Vite + Express Dual Subsystems)
- The system uses a clean, domain-separated backend architecture for scalable maintainability:
  - `server.ts`: Entry point setting up the Express app, authentication middleware, and mounting Vite for frontend.
  - `src-server/legacyRouter.ts`: Handles the initialization of SQLite and DuckDB databases (`primary.db` for K Module, `statutory.db` for P Module). Exports `setupRoutes` which delegates IPC handlers.
  - `COMMAND_MAP` (`src-server/commands/index.ts`): The monolithic switch block has been entirely eliminated and replaced with a scalable `COMMAND_MAP` that routes incoming frontend requests to domain-specific command handlers.
  - Domain Command Handlers (`src-server/commands/domain_name.ts`): Completely separated backend command controllers (e.g. `masters_settings.ts`, `transactions.ts`, `reports.ts`, `audit.ts`, `auth.ts`, `payroll_processing.ts`, `canteen.ts`). They access database instances injected via `CommandContext` (`ctx.primaryDb` and `ctx.statutoryDb`).

16. DATA SYNC & THE AUDIT CIRCUIT BREAKER
- Module K is the source of truth for "Actuals". Module P is the source of truth for "Compliance" and Statutory reports.
- **Sync Engine**: 
  - Real-time raw data ONLY sync from K to P (no processed calculations are synced). 
  - K Module inserts UPSERT/DELETE actions into `employee_sync_queue` and `sync_queue`. The Sync Engine processes these into `statutory.db` (P).
  - Includes checksum validation (`/api/sync/checksum`) to ensure K and P table parity for critical masters.
- **Workspace Switcher (Alt+Shift+K)**: Lightweight global UI switcher between K and P modules managed by a Zustand store (`src/store/workspaceStore.ts`). This is a **UI switch only**. It does NOT disconnect the backend bridge, nor interrupt the real-time sync process. It preserves the last active route per module and ensures completely separate view contexts.
- **Audit Mode (K Disconnected)**: 
  - Toggled via the UI Toggle (No longer toggled via Alt+Shift+K).
  - When disconnected, K and P sever the automated bridge. P Module operates entirely standalone using its cached data. 
  - `report_snapshots` in K-module retains a snapshot of P-module data. If K runs a P-dependent report while disconnected, it uses this snapshot and displays a Timestamped Cache Warning Banner.

17. REPORTING & ANALYTICS
- Reporting Engine: Separate templates and snapshots are stored strictly bounded by `module_type` (K or P).
- AG Grid is the primary tabular workhorse, supporting dynamic columns, pagination, Excel export, drill-downs, and layout-preservation via the template configuration.
- Analytics Dashboards: Driven by Apache ECharts (`ReactECharts`). Backend DuckDB aggregation APIs process huge datasets over the SQLite files in-process. Charts include Line, Pie, Bar, Heatmap, and onClick Drilldown panels separated by Module Context (K vs P).
- Enterprise Excel Export Engine: Utilizes `exceljs` on the Node.js backend. Features dynamic column pivoting (e.g. Salary Heads), multi-sheet workbooks, frozen panes, headers grouping, conditional formatting, and password protection without loading massive datasets directly into client memory. All outputs are delivered as direct base64 file blobs.

18. ENTERPRISE RBAC ENGINE
- **Architecture**: A centralized, component-level permission system.
- **Data Model**: Uses `roles`, `permissions`, `permission_modules`, `permission_pages`, `permission_components`, `role_permissions`, `role_templates`, and `role_template_permissions`.
- **Authorisation Logic**: Replaced all hardcoded checks with dynamic `authorize(user, permissionStr, currentModuleContext)` resolver.
- **Module Context**: Permissions can be scoped to K, P, or BOTH. The Auditor role is strictly isolated to P module space.
- **Password Recovery**: Implemented via `verify_identity` and `reset_password` commands. Features bcrypt hashing, token generation with expiration tracking, and multi-factor verification.
- **Audit Logging**: Every core mutation includes immutable `created_by`, `modified_by`, `deleted_by` auditing, storing old vs new state via `audit_logs` service.

19. FILE STRUCTURE & PROJECT ORGANIZATION (STRICT)
- As defined in the `AUDIT_AND_REFACTOR_PLAN.md`, all future features and refactors must strictly adhere to the following file structure constraints.
- **Root Directory**: Kept clean. No utility scripts or database files.
- **`scripts/`**: All utility, test, validation, migration, and extraction scripts go into subdirectories here (`validation/`, `testing/`, `utils/`, `migration/`).
- **`data/`**: All local database files (`primary.db`, `statutory.db`, and their shm/wal files) must reside here.
- **`src/` (Frontend React)**:
  - `components/`: Organized by `common/`, `layout/`, `form/`, `table/`, `auth/`, `rbac/`.
  - `modules/`: Contains business domain routing logic and grouped UI.
  - `services/`: API client files, organized by domain.
  - `store/`: Zustand state management.
  - `utils/`: Grouped utilities (`date/`, `format/`, `calculation/`).
  - `types/`: Centralized interfaces (`domain/`, `api/`, `store/`, `ui/`).
- **`src-server/` (Backend Express)**:
  - Domain-specific logic enclosed in `domains/` or `commands/`.
  - Shared middleware in `middleware/`.
  - SQLite/DuckDB management in `db/`.
- **`Documentation/`**: Contains `CODEBASE.md`, `ROUTE_MAP.md`, `schema_fields.txt`, etc.
- Always implement changes according to this modular directory structure to guarantee long-term maintainability.
