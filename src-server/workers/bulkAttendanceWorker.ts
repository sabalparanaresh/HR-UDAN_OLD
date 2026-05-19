import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';
import { SQLiteOptimizer } from '../db/optimizer.js';

const { dbPath, fromDate, toDate, filters } = workerData;

let isCancelled = false;
if (parentPort) {
  parentPort.on('message', (msg) => {
    if (msg && msg.type === 'cancel') {
      isCancelled = true;
    }
  });
}

try {
  // SQLite connection
  const db = new Database(dbPath, { timeout: 15000 });
  
  SQLiteOptimizer.applyEnterprisePragmas(db);
  SQLiteOptimizer.enableSlowQueryLog(db, 300);

  // 1. Identify Employees based on filters
  let empSql = 'SELECT id, emp_code, name, department_id, designation_id, shift_id, category_id, location_id, division_id, group_id FROM employees WHERE status = 1';
  const empParams: any[] = [];
  
  if (filters) {
    const arrayFilter = (field: string, values: any) => {
      if (Array.isArray(values) && values.length > 0) {
        empSql += ` AND ${field} IN (${values.map(()=>'?').join(', ')})`;
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
  
  // 2. Fetch Shifts for mapping
  const shifts = db.prepare('SELECT id, name, start_time, end_time, total_working_hours FROM shifts').all() as any[];
  const shiftMap = new Map(shifts.map(s => [s.id, s]));
  
  // 3. Fetch Holidays to skip
  const holidays = db.prepare('SELECT date FROM holidays WHERE status = 1').all() as any[];
  const holidaySet = new Set(holidays.map(h => h.date));
  
  const results = {
    total_records: 0,
    skipped_missing_shift: [] as string[],
    processed_employees: employees.length
  };

  const CHUNK_SIZE = 500;
  
  const insertStmt = db.prepare(`
    INSERT INTO attendance_logs (
      emp_id, emp_code, emp_name, date, punch_in, punch_out, 
      shift_id, shift_name, status, machine_name, 
      worked_mins, total_time_mins, attendance_value, punches
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BULK_V2_WORKER', ?, ?, ?, ?)
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

  const start = new Date(fromDate);
  const end = new Date(toDate);
  
  let validDates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!holidaySet.has(dateStr)) {
      validDates.push(dateStr);
    }
  }

  // Pre-calculate shift data for each employee
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

  // Calculate total iterations for progress reporting
  const totalOperations = validDates.length * employees.length;
  let operationsDone = 0;
  
  // We chunk by employees
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  async function processChunks() {
    for (let i = 0; i < employeeData.length; i += CHUNK_SIZE) {
        // Check for cancellation
        if (isCancelled) { 
            throw new Error("Worker execution cancelled.");
        }

        const chunk = employeeData.slice(i, i + CHUNK_SIZE);
        
        const chunkInsert = db.transaction((currentChunk: typeof employeeData, dates: string[]) => {
            let count = 0;
            for (const item of currentChunk) {
                if (!item.hasShift) {
                   if (dates.length > 0 && dates[0] === fromDate) {
                       results.skipped_missing_shift.push(item.emp.name);
                   }
                   continue;
                }

                for (const dateStr of dates) {
                    const punchIn = `${dateStr}T${item.startTime}:00`;
                    const punchOut = `${dateStr}T${item.endTime}:00`;
                    
                    const row = insertStmt.get(
                      item.emp.id, item.emp.emp_code, item.emp.name, dateStr, punchIn, punchOut,
                      item.shift.id, item.shift.name, item.attnVal > 0 ? 'PRESENT' : 'ABSENT',
                      Math.round(item.workingHours * 60), Math.round(item.workingHours * 60), item.attnVal,
                      JSON.stringify([{ punch_in: punchIn, punch_out: punchOut }])
                    ) as any;
                    
                    if (row && row.id) {
                      deletePunchesStmt.run(row.id);
                      insertPunchStmt.run(row.id, punchIn, 'IN', 'BULK_V2_WORKER');
                      insertPunchStmt.run(row.id, punchOut, 'OUT', 'BULK_V2_WORKER');
                    }
                    count++;
                }
            }
            return count;
        });

        const recordsInserted = chunkInsert(chunk, validDates);
        results.total_records += recordsInserted;
        operationsDone += chunk.length * validDates.length;

        // Report progress
        if (parentPort) {
           parentPort.postMessage({ 
              type: 'progress', 
              data: { 
                  processed: operationsDone, 
                  total: totalOperations,
                  percentage: Math.round((operationsDone / totalOperations) * 100)
              }
           });
        }
        
        // Yield lock for 5ms to allow main thread to process DB writes if needed
        await delay(5);
    }

    // Optimize and flush WAL
    db.pragma('wal_checkpoint(TRUNCATE)');

    if (parentPort) {
        parentPort.postMessage({ type: 'done', data: results });
    }
  }

  processChunks().catch(e => {
     if (parentPort) {
        parentPort.postMessage({ type: 'error', error: e.message || String(e) });
     }
  });

} catch(e: any) {
  if (parentPort) {
      parentPort.postMessage({ type: 'error', error: e.message || String(e) });
  }
}
