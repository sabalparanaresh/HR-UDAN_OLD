import Database from 'better-sqlite3';
import { SQLiteOptimizer } from '../db/optimizer.js';

export interface AttendanceProgressData {
  processed: number;
  total: number;
  percentage: number;
}

export interface BulkAttendanceFilters {
  departmentId?: any;
  locationId?: any;
  divisionId?: any;
  groupId?: any;
  categoryId?: any;
  designationId?: any;
  classId?: any;
}

export interface BulkResult {
  total_records: number;
  skipped_missing_shift: string[];
  processed_employees: number;
}

/**
 * Manages the memory-efficient queueing of chunked bulk attendance tasks.
 */
export class AttendanceChunkQueue {
  private queue: Array<{
    employeesChunk: any[];
    validDates: string[];
    shiftMap: Map<number, any>;
  }> = [];

  public clear() {
    this.queue = [];
  }

  public enqueue(employeesChunk: any[], validDates: string[], shiftMap: Map<number, any>) {
    this.queue.push({ employeesChunk, validDates, shiftMap });
  }

  public dequeue() {
    return this.queue.shift();
  }

  public get length() {
    return this.queue.length;
  }
}

/**
 * Coordination engine to run bulk monthly attendance inside transaction-safe,
 * chunked async tasks. This satisfies all performance rules, avoids thread crashes
 * or memory failures, and allows easy real-time progress emissions.
 */
export class AttendanceBulkProcessor {
  private static instance: AttendanceBulkProcessor | null = null;
  private isCancelled = false;
  private isRunning = false;
  private chunkQueue: AttendanceChunkQueue;

  private constructor() {
    this.chunkQueue = new AttendanceChunkQueue();
  }

  public static getInstance(): AttendanceBulkProcessor {
    if (!AttendanceBulkProcessor.instance) {
      AttendanceBulkProcessor.instance = new AttendanceBulkProcessor();
    }
    return AttendanceBulkProcessor.instance;
  }

  public cancel() {
    if (this.isRunning) {
      this.isCancelled = true;
    }
  }

  public getActiveStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Main processor execution loop.
   */
  public async generateBulk(
    dbPath: string,
    fromDate: string,
    toDate: string,
    filters: BulkAttendanceFilters | undefined,
    onProgress: (progress: AttendanceProgressData) => void,
    onDone: (result: BulkResult) => void,
    onError: (err: any) => void
  ) {
    if (this.isRunning) {
      // Cancel active running generation to prevent conflict
      this.isCancelled = true;
      // Wait briefly for cancellation to take effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.chunkQueue.clear();

    let db: Database.Database | null = null;

    try {
      db = new Database(dbPath, { timeout: 15000 });
      SQLiteOptimizer.applyEnterprisePragmas(db);
      SQLiteOptimizer.enableSlowQueryLog(db, 300);

      // 1. Fetch relevant employees matching filters
      let empSql = 'SELECT id, emp_code, name, department_id, designation_id, shift_id, category_id, location_id, division_id, group_id FROM employees WHERE status = 1';
      const empParams: any[] = [];

      if (filters) {
        const arrayFilter = (field: string, values: any) => {
          if (Array.isArray(values) && values.length > 0) {
            empSql += ` AND ${field} IN (${values.map(() => '?').join(', ')})`;
            empParams.push(...values);
          } else if (values && typeof values === 'string') {
            empSql += ` AND ${field} = ?`;
            empParams.push(values);
          }
        };
        arrayFilter('department_id', filters.departmentId);
        arrayFilter('location_id', filters.locationId);
        arrayFilter('division_id', filters.divisionId);
        arrayFilter('group_id', filters.groupId);
        arrayFilter('category_id', filters.categoryId);
        arrayFilter('designation_id', filters.designationId);
        arrayFilter('class_id', filters.classId);
      }

      const employees = db.prepare(empSql).all(...empParams) as any[];

      if (employees.length === 0) {
        this.isRunning = false;
        onDone({
          total_records: 0,
          skipped_missing_shift: [],
          processed_employees: 0
        });
        return;
      }

      // 2. Fetch shifts
      const shifts = db.prepare('SELECT id, name, start_time, end_time, total_working_hours FROM shifts').all() as any[];
      const shiftMap = new Map<number, any>(shifts.map(s => [s.id, s]));

      // 3. Fetch holidays
      const holidays = db.prepare('SELECT date FROM holidays WHERE status = 1').all() as any[];
      const holidaySet = new Set(holidays.map(h => h.date));

      // 4. Generate valid dates list
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const validDates: string[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!holidaySet.has(dateStr)) {
          validDates.push(dateStr);
        }
      }

      // Pre-calculate shift availability to separate actionable records
      const employeeData = employees.map(emp => {
        const shiftId = emp.shift_id;
        if (!shiftId || !shiftMap.has(shiftId)) {
          return { emp, hasShift: false };
        }
        const shift = shiftMap.get(shiftId) as any;
        const startTime = shift.start_time || '08:00';
        const endTime = shift.end_time || '20:00';
        const workingHours = shift.total_working_hours || 12.0;
        const attnVal = workingHours >= 8 ? 1.0 : (workingHours >= 4 ? 0.5 : 0.0);

        return {
          emp,
          hasShift: true,
          shift,
          startTime,
          endTime,
          workingHours,
          attnVal
        };
      });

      const totalOperations = validDates.length * employees.length;
      let operationsDone = 0;

      const results: BulkResult = {
        total_records: 0,
        skipped_missing_shift: [] as string[],
        processed_employees: employees.length
      };

      // Chunk size to prevent holding too much RAM or lockups
      const CHUNK_SIZE = 100;
      for (let i = 0; i < employeeData.length; i += CHUNK_SIZE) {
        const chunk = employeeData.slice(i, i + CHUNK_SIZE);
        this.chunkQueue.enqueue(chunk, validDates, shiftMap);
      }

      // Initialize prepared SQL statements for batch executions
      const insertStmt = db.prepare(`
        INSERT INTO attendance_logs (
          emp_id, emp_code, emp_name, date, punch_in, punch_out, 
          shift_id, shift_name, status, machine_name, 
          worked_mins, total_time_mins, attendance_value, punches
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BULK_V2_PROCESSOR', ?, ?, ?, ?)
        ON CONFLICT(emp_id, date) DO UPDATE SET
          punch_in = excluded.punch_in,
          punch_out = excluded.punch_out,
          shift_id = excluded.shift_id,
          shift_name = excluded.shift_name,
          status = excluded.status,
          machine_name = excluded.machine_name,
          worked_mins = excluded.worked_mins,
          total_time_mins = excluded.total_time_mins,
          attendance_value = excluded.attendance_value,
          punches = excluded.punches
        RETURNING id
      `);

      const deletePunchesStmt = db.prepare(`DELETE FROM attendance_punches WHERE attendance_log_id = ?`);
      const insertPunchStmt = db.prepare(`
        INSERT INTO attendance_punches (attendance_log_id, punch_time, punch_type, device_id) 
        VALUES (?, ?, ?, ?)
      `);

      const executeNextChunk = async () => {
        if (this.isCancelled) {
          throw new Error('Bulk generation cancelled by user.');
        }

        const nextJob = this.chunkQueue.dequeue();
        if (!nextJob) {
          // Finished all queue chunks
          db?.pragma('wal_checkpoint(TRUNCATE)');
          this.isRunning = false;
          onDone(results);
          return;
        }

        const { employeesChunk } = nextJob;

        // Perform transactional safe writes inside db transaction block
        const transactionExecute = db!.transaction(() => {
          let chunkRecordsCount = 0;
          for (const item of employeesChunk) {
            if (!item.hasShift) {
              if (validDates.length > 0 && validDates[0] === fromDate) {
                results.skipped_missing_shift.push(item.emp.name);
              }
              continue;
            }

            for (const dateStr of validDates) {
              const punchIn = `${dateStr}T${item.startTime}:00`;
              const punchOut = `${dateStr}T${item.endTime}:00`;

              const row = insertStmt.get(
                item.emp.id,
                item.emp.emp_code,
                item.emp.name,
                dateStr,
                punchIn,
                punchOut,
                item.shift.id,
                item.shift.name,
                item.attnVal > 0 ? 'PRESENT' : 'ABSENT',
                Math.round(item.workingHours * 60),
                Math.round(item.workingHours * 60),
                item.attnVal,
                JSON.stringify([{ punch_in: punchIn, punch_out: punchOut }])
              ) as any;

              if (row && row.id) {
                deletePunchesStmt.run(row.id);
                insertPunchStmt.run(row.id, punchIn, 'IN', 'BULK_V2_PROCESSOR');
                insertPunchStmt.run(row.id, punchOut, 'OUT', 'BULK_V2_PROCESSOR');
              }
              chunkRecordsCount++;
            }
          }
          return chunkRecordsCount;
        });

        const recordsInserted = transactionExecute();
        results.total_records += recordsInserted;
        operationsDone += employeesChunk.length * validDates.length;

        // Broadcast granular progress to clients
        onProgress({
          processed: operationsDone,
          total: totalOperations,
          percentage: Math.min(100, Math.round((operationsDone / totalOperations) * 100))
        });

        // Yield to Node's Event Loop for 20ms using setTimeout.
        // This decouples CPU blocking and allows concurrent API / UI request handling.
        await new Promise(resolve => setTimeout(resolve, 20));
        await executeNextChunk();
      };

      // Start the chunk queue processing recursively
      await executeNextChunk();

    } catch (e: any) {
      this.isRunning = false;
      this.chunkQueue.clear();
      onError(e);
    } finally {
      if (db) {
        try {
          db.close();
        } catch (_) {}
      }
    }
  }
}
