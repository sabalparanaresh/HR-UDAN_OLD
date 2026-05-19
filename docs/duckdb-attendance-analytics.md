# DuckDB Attendance Analytics Architecture

## Overview
This document outlines the implementation of the analytics layer for attendance reporting using DuckDB, explicitly designed to relieve the primary `.db` SQLite files from heavy aggregation queries while maintaining SQLite as the absolute source of truth.

## 1. DuckDB Integration & Sync Pipeline
Instead of copying individual rows to DuckDB over IPC, we utilize DuckDB's native **SQLite Scanner**.
DuckDB is initialized in `:memory:` mode and immediately ATTACHes `primary.db` and `statutory.db` in `READ_ONLY` mode. 
This allows DuckDB to execute high-speed analytic queries concurrently alongside the operational Express SQLite process.

## 2. Aggregation Queries & Caching Strategy
To build aggregations efficiently without slowing down operational tables, we employ a **Materialized Aggregation Strategy**.
A background scheduler (`DuckDBAnalytics.refreshMaterializedViews`) drops and recreates snapshot tables (caches) in DuckDB memory:
- `analytics_attendance_monthly`
- `analytics_attendance_department`
- `analytics_attendance_anomalies`

This runs via `CTAS` (Create Table As Select) inside DuckDB, quickly querying the attached SQLite database and saving the condensed dimensions. The process can handle 5+ years of reporting because the analytical calculations are pre-aggregated and stored locally inside DuckDB memory.

## 3. Repository Layer (`DuckDBAttendanceRepo`)
The `DuckDBAttendanceRepo` class isolates query logic and provides methods like `getMonthlySummary`, `getDepartmentSummary`, and `getAnomalies`. This abstracts the cached DuckDB data behind type-safe standard functions.

## 4. Reporting Architecture & Integration Flow
### Data Flow
1. **Source of Truth:** K Module records actual punches in SQLite (`primary.db`), and filtered compliance data is passed to P Module (`statutory.db`).
2. **Snapshot Materialization:** Scheduled intervals invoke `refreshMaterializedViews()`.
3. **API Access:** The Node.js command router handles `get_historical_attendance_analytics` which calls the `DuckDBAttendanceRepo`.
4. **Offline First:** The `duckdb` module is bundled natively in the desktop executable context using Edge SQLite reading patterns. No internet connection is required.

### Example UI Call
\`\`\`ts
import { invokeCommand } from '../services/apiClient';

const historicalData = await invoke('get_historical_attendance_analytics', { 
  moduleType: 'K' 
});
console.log(historicalData.monthlySummary);
\`\`\`
