import { Worker } from 'worker_threads';
import path from 'path';
import { CommandHandler } from './types.js';
import { isKConnected } from '../utils/helpers.js';

export const fetchBiometricLogs: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args?.module_type || args?.moduleType || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  try {
    const config = db.prepare('SELECT * FROM company_config LIMIT 1').get() as any;
    if (!config) {
      return res.status(400).json({ error: 'Company configuration not found.' });
    }

    const { connection_type, connection_string, db_name, procedure_name, db_user } = config;
    
    // Simulate connection and fetch based on config
    console.log(`[Biometric Sync] Attempting to connect via ${connection_type}`);
    if (connection_type === 'SQL Server' || connection_type === 'MS Access') {
      console.log(`[Biometric Sync] Connection String: ${connection_string}`);
      console.log(`[Biometric Sync] DB Name: ${db_name}, User: ${db_user}`);
      console.log(`[Biometric Sync] Executing Procedure/Query: ${procedure_name}`);
    }

    // Mock response after simulated fetch
    res.json([
      { emp_id: 1, punch_time: new Date().toISOString(), type: 'IN' },
      { emp_id: 2, punch_time: new Date().toISOString(), type: 'IN' }
    ]);
  } catch (err) {
    console.error('[Biometric Sync] Error:', err);
    res.status(500).json({ error: 'Failed to fetch biometric logs' });
  }
};

export const availableBiometricReaders: CommandHandler = (ctx) => {
  ctx.res.json([
    { id: 'READER-01', name: 'Main Gate Reader', ip: '192.168.1.10', status: 'ONLINE' },
    { id: 'READER-02', name: 'Back Gate Reader', ip: '192.168.1.11', status: 'OFFLINE' }
  ]);
};

export const checkBiometricConnection: CommandHandler = (ctx, args) => {
  const { readerId } = args;
  ctx.res.json({ connected: readerId === 'READER-01', timestamp: new Date().toISOString() });
};

export const generateGhostPunches: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { monthYear, filters } = args;
  
  let sql = 'SELECT id, emp_code, name, shift_id FROM employees WHERE status = 1';
  const params: any[] = [];
  if (filters) {
    const arrayFilter = (field: string, values: any) => {
      if (Array.isArray(values) && values.length > 0) {
        sql += ` AND ${field} IN (${values.map(()=>'?').join(', ')})`;
        params.push(...values);
      } else if (values && typeof values === 'string') {
        sql += ` AND ${field} = ?`;
        params.push(values);
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
  
  const employees = statutoryDb.prepare(sql).all(...params) as any[];
  
  if (employees.length === 0) {
    return res.status(400).json({ error: 'No employees found matching filters' });
  }

  const worker = new Worker(path.resolve('./attendanceWorker.ts'), {
    workerData: { 
      mode: 'P', 
      type: 'GENERATE_GHOST_PUNCHES',
      monthYear,
      employeeList: employees
    }
  });

  worker.on('message', (msg) => {
    if (msg.success) res.json({ status: 'success' });
    else res.status(500).json({ error: msg.error });
  });

  worker.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
};

export const processAttendance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { fromDate, toDate, moduleType } = args;
  const isKDisc = !isKConnected(primaryDb);
  const shiftDb = moduleType === 'P' ? statutoryDb : primaryDb;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  
  const logs = db.prepare('SELECT * FROM attendance_logs WHERE date >= ? AND date <= ?').all(fromDate, toDate) as any[];
  
  const shifts = shiftDb.prepare('SELECT id, rules FROM shifts').all() as any[];
  const shiftRulesMap = new Map();
  shifts.forEach(s => {
    try {
      shiftRulesMap.set(s.id, typeof s.rules === 'string' ? JSON.parse(s.rules) : (s.rules || []));
    } catch (e) {
      shiftRulesMap.set(s.id, []);
    }
  });

  const empShiftMap = new Map();
  const emps = db.prepare('SELECT id, shift_id FROM employees').all() as any[];
  emps.forEach(e => empShiftMap.set(e.id, e.shift_id));

  for (const log of logs) {
    let workedMins = 0;
    let totalTimeMins = 0;
    let outsideMins = 0;
    let attendanceValue = 0;

    const shiftId = empShiftMap.get(log.emp_id);
    const rules = shiftId ? (shiftRulesMap.get(shiftId) || []) : [];

    let punches = [];
    try {
      punches = log.punches ? JSON.parse(log.punches) : [];
    } catch (e) {
      punches = [];
    }

    if (punches.length === 0 && log.punch_in && log.punch_out) {
      punches = [{ punch_in: log.punch_in, punch_out: log.punch_out }];
    }

    if (punches.length > 0) {
      punches.sort((a: any, b: any) => new Date(a.punch_in).getTime() - new Date(b.punch_in).getTime());
      const firstIn = new Date(punches[0].punch_in);
      const lastOut = new Date(punches[punches.length - 1].punch_out);

      if (firstIn.getTime() && lastOut.getTime()) {
        totalTimeMins = Math.max(0, Math.floor((lastOut.getTime() - firstIn.getTime()) / (1000 * 60)));
      }

      for (let i = 0; i < punches.length; i++) {
        const p = punches[i];
        if (p.punch_in && p.punch_out) {
          const sin = new Date(p.punch_in);
          const sout = new Date(p.punch_out);
          workedMins += Math.max(0, Math.floor((sout.getTime() - sin.getTime()) / (1000 * 60)));
        }
      }
      outsideMins = Math.max(0, totalTimeMins - workedMins);

      let matchedRule = false;
      for (const rule of rules) {
        const ruleFromMins = (rule.fromHours || 0) * 60 + (rule.fromMinutes || 0);
        const ruleToMins = (rule.toHours || 0) * 60 + (rule.toMinutes || 0);
        if (workedMins >= ruleFromMins && workedMins < ruleToMins) {
          attendanceValue = rule.attendanceValue;
          matchedRule = true;
          break;
        }
      }
      if (!matchedRule && rules.length > 0) {
        const lastRule = rules[rules.length - 1];
        if (workedMins >= (lastRule.toHours * 60 + lastRule.toMinutes)) {
          attendanceValue = lastRule.attendanceValue;
        }
      }
    }

    db.prepare('UPDATE attendance_logs SET worked_mins = ?, total_time_mins = ?, outside_mins = ?, attendance_value = ? WHERE id = ?')
      .run(workedMins, totalTimeMins, outsideMins, attendanceValue, log.id);
  }
  res.json({ status: 'success' });
};

export const bulkAttendanceV2: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { fromDate, toDate, filters, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

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

  db.transaction(() => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (holidaySet.has(dateStr)) continue;
      
      for (const emp of employees) {
        const shiftId = emp.shift_id;
        if (!shiftId || !shiftMap.has(shiftId)) {
          if (dateStr === fromDate) { 
            results.skipped_missing_shift.push(emp.name);
          }
          continue;
        }
        
        const shift = shiftMap.get(shiftId) as any;
        const startTime = shift.start_time || '08:00';
        const endTime = shift.end_time || '20:00';
        const workingHours = shift.total_working_hours || 12.0;

        const punchIn = `${dateStr}T${startTime}:00`;
        const punchOut = `${dateStr}T${endTime}:00`;
        const attnVal = workingHours >= 8 ? 1.0 : (workingHours >= 4 ? 0.5 : 0.0);

        db.prepare(`
          INSERT INTO attendance_logs (
            emp_id, emp_code, emp_name, date, punch_in, punch_out, 
            shift_id, shift_name, status, machine_name, 
            worked_mins, total_time_mins, attendance_value, punches
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BULK_V2', ?, ?, ?, ?)
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
        `).run(
          emp.id, emp.emp_code, emp.name, dateStr, punchIn, punchOut,
          shift.id, shift.name, attnVal > 0 ? 'PRESENT' : 'ABSENT',
          Math.round(workingHours * 60), Math.round(workingHours * 60), attnVal,
          JSON.stringify([{ punch_in: punchIn, punch_out: punchOut }])
        );
        
        results.total_records++;
      }
    }
  })();

  res.json({ status: 'success', summary: results });
};

export const getAttendanceLogs: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { filters, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          
          let sql = `
            SELECT 
              al.*,
              COALESCE(al.emp_code, e.emp_code) as emp_code,
              COALESCE(al.emp_name, e.name, trim(COALESCE(e.first_name, '') || ' ' || COALESCE(e.middle_name, '') || ' ' || COALESCE(e.last_name, ''))) as emp_name,
              COALESCE(al.department_name, dept.name) as department_name,
              COALESCE(al.designation_name, desig.name) as designation_name,
              COALESCE(al.shift_name, s.name) as shift_name,
              e.blacklist_status
            FROM attendance_logs al
            LEFT JOIN employees e ON al.emp_id = e.id
            LEFT JOIN departments dept ON e.department_id = dept.id
            LEFT JOIN designations desig ON e.designation_id = desig.id
            LEFT JOIN shifts s ON al.shift_id = s.id
            WHERE 1=1
          `;
          const params: any[] = [];

          if (filters) {
            if (filters.fromDate) {
              sql += ' AND al.date >= ?';
              params.push(filters.fromDate);
            }
            if (filters.toDate) {
              sql += ' AND al.date <= ?';
              params.push(filters.toDate);
            }
            if (filters.isMissed) {
              sql += ' AND al.is_missed_punch = 1';
            }
            const arrayFilter = (field: string, values: any) => {
              if (Array.isArray(values) && values.length > 0) {
                sql += ` AND ${field} IN (${values.map(()=>'?').join(', ')})`;
                params.push(...values);
              } else if (values && typeof values === 'string') {
                sql += ` AND ${field} = ?`;
                params.push(values);
              }
            };
            
            arrayFilter('e.department_id', filters.departmentId);
            arrayFilter('e.location_id', filters.locationId);
            arrayFilter('e.division_id', filters.divisionId);
            arrayFilter('e.group_id', filters.groupId);
            arrayFilter('e.category_id', filters.categoryId);
            arrayFilter('e.class_id', filters.classId);
            arrayFilter('e.designation_id', filters.designationId);
            arrayFilter('al.machine_name', filters.machineName);

            if (filters.empCodes && Array.isArray(filters.empCodes) && filters.empCodes.length > 0) {
              sql += ` AND e.emp_code IN (${filters.empCodes.map(() => '?').join(', ')})`;
              params.push(...filters.empCodes);
            }
          }

          const logs = db.prepare(sql).all(...params);
          res.json(logs);
          
};

export const saveBiometricLogs: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { logs, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          
          // Group punches by employee and date
          const grouped: Record<string, any[]> = {};
          for (const rawLog of logs) {
            const date = rawLog.punch_time.split('T')[0];
            const key = `${rawLog.emp_code}_${date}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(rawLog);
          }

          let savedCount = 0;
          for (const key in grouped) {
            const [empCode, date] = key.split('_');
            const empPunches = grouped[key].sort((a, b) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
            
            // Convert simple type-based punches to pairs
            const pairs = [];
            for (let i = 0; i < empPunches.length; i++) {
              if (empPunches[i].type === 'IN') {
                const nextOut = empPunches.slice(i + 1).find(p => p.type === 'OUT');
                pairs.push({
                  punch_in: empPunches[i].punch_time,
                  punch_out: nextOut ? nextOut.punch_time : null
                });
                if (nextOut) i = empPunches.indexOf(nextOut);
              } else if (i === 0 && empPunches[i].type === 'OUT') {
                // Out without in (missed start)
                pairs.push({ punch_in: null, punch_out: empPunches[i].punch_time });
              }
            }

            const emp = db.prepare('SELECT id, name FROM employees WHERE emp_code = ?').get(empCode) as any;
            if (emp) {
              db.prepare(`
                INSERT INTO attendance_logs (emp_id, date, punch_in, punch_out, punches, status, machine_name)
                VALUES (?, ?, ?, ?, ?, 'PRESENT', 'BIOMETRIC')
                ON CONFLICT(emp_id, date) DO UPDATE SET
                  punch_in = excluded.punch_in,
                  punch_out = excluded.punch_out,
                  punches = excluded.punches
              `).run(
                emp.id, 
                date, 
                pairs[0]?.punch_in || null, 
                pairs[pairs.length - 1]?.punch_out || null,
                JSON.stringify(pairs)
              );
              savedCount++;
            }
          }

          res.json({ status: 'success', savedCount });
          
};

export const bulkGenerateAttendance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { logs, module_type } = args;
          const db = module_type === 'P' ? statutoryDb : primaryDb;
          
          const insert = db.prepare(`
            INSERT INTO attendance_logs (
              emp_id, emp_code, emp_name, department_name, designation_name, 
              shift_name, shift_id, date, punch_in, punch_out, 
              total_time_mins, worked_mins, outside_mins, attendance_value, 
              status, is_missed_punch, blacklist_status, machine_name, punches
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(emp_id, date) DO UPDATE SET
              punch_in = excluded.punch_in,
              punch_out = excluded.punch_out,
              shift_id = excluded.shift_id,
              status = excluded.status,
              machine_name = excluded.machine_name,
              total_time_mins = excluded.total_time_mins,
              worked_mins = excluded.worked_mins,
              attendance_value = excluded.attendance_value
          `);

          db.transaction(() => {
            for (const log of logs) {
              insert.run(
                log.emp_id, log.emp_code, log.emp_name, log.department_name, log.designation_name,
                log.shift_name, log.shift_id, log.date, log.punch_in, log.punch_out,
                log.total_time_mins, log.worked_mins, log.outside_mins, log.attendance_value,
                log.status, log.is_missed_punch ? 1 : 0, log.blacklist_status ? 1 : 0, log.machine_name, log.punches
              );
            }
          })();

          res.json(`Successfully generated ${logs.length} attendance records`);
          
};

export const updatePunch: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { logId, type, time, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const field = type === 'IN' ? 'punch_in' : 'punch_out';
          db.prepare(`UPDATE attendance_logs SET ${field} = ? WHERE id = ?`).run(time, logId);
          res.json({ status: 'success' });
          
};

export const updateShift: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { logId, shiftId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          db.prepare('UPDATE attendance_logs SET shift_id = ? WHERE id = ?').run(shiftId, logId);
          res.json({ status: 'success' });
          
};

export const bulkUploadAttendanceExcel: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { records, module_type } = args;
          const db = module_type === 'P' ? statutoryDb : primaryDb;

          const findEmp = db.prepare('SELECT id FROM employees WHERE emp_code = ? LIMIT 1');
          
          const insertOrUpdate = db.prepare(`
            INSERT INTO attendance_logs (
              emp_id, date, punch_in, punch_out, status, machine_name, 
              worked_mins, total_time_mins, outside_mins, attendance_value, punches
            ) 
            VALUES (?, ?, ?, ?, 'PRESENT', 'EXCEL_UPLOAD', ?, ?, 0, ?, '[]')
            ON CONFLICT(emp_id, date) DO UPDATE SET
              punch_in = excluded.punch_in,
              punch_out = excluded.punch_out,
              worked_mins = excluded.worked_mins,
              total_time_mins = excluded.total_time_mins,
              attendance_value = excluded.attendance_value,
              status = 'PRESENT',
              machine_name = 'EXCEL_UPLOAD'
          `);

          let successCount = 0;
          const errors: string[] = [];

          db.transaction(() => {
            for (const rec of records) {
              const { emp_code, date, punch_in, punch_out } = rec;
              if (!emp_code || !date) continue;
              
              const emp = findEmp.get(String(emp_code).trim()) as any;
              
              if (!emp) {
                errors.push(`Employee code ${emp_code} not found.`);
                continue;
              }

              let workedMins = 0;
              if (punch_in && punch_out) {
                const start = new Date(punch_in);
                const end = new Date(punch_out);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  workedMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60)));
                }
              }

              const attendanceValue = workedMins >= 480 ? 1.0 : (workedMins >= 240 ? 0.5 : 0.0);

              insertOrUpdate.run(
                emp.id, date, punch_in || null, punch_out || null, 
                workedMins, workedMins, attendanceValue
              );
              successCount++;
            }
          })();

          res.json({ success: true, processed: successCount, errors });
          
};

export const saveManualAttendance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { emp_id, empId, date, punch_in, punchIn, punch_out, punchOut, shift_id, shiftId, module_type, moduleType } = args;
          const currentEmpId = emp_id || empId;
          const currentPunchIn = punch_in || punchIn;
          const currentPunchOut = punch_out || punchOut;
          const currentShiftId = shift_id || shiftId;
          const currentModuleType = module_type || moduleType;
          
          const db = currentModuleType === 'P' ? statutoryDb : primaryDb;
          
          // Calculate durations for this single pair if both exist
          let workedMins = 0;
          let totalMins = 0;
          if (currentPunchIn && currentPunchOut) {
            const start = new Date(currentPunchIn);
            const end = new Date(currentPunchOut);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              workedMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60)));
              totalMins = workedMins;
            }
          }

          const attendanceValue = workedMins >= 480 ? 1.0 : (workedMins >= 240 ? 0.5 : 0.0);
          
          db.prepare(`
            INSERT INTO attendance_logs (
              emp_id, date, punch_in, punch_out, shift_id, status, machine_name, 
              worked_mins, total_time_mins, outside_mins, attendance_value, punches
            ) 
            VALUES (?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?, 0, ?, ?)
            ON CONFLICT(emp_id, date) DO UPDATE SET
              punch_in = excluded.punch_in,
              punch_out = excluded.punch_out,
              shift_id = excluded.shift_id,
              status = excluded.status,
              machine_name = excluded.machine_name,
              worked_mins = excluded.worked_mins,
              total_time_mins = excluded.total_time_mins,
              attendance_value = excluded.attendance_value,
              punches = excluded.punches
          `).run(
            currentEmpId, date, currentPunchIn, currentPunchOut, currentShiftId, 
            attendanceValue > 0 ? 'PRESENT' : 'ABSENT',
            workedMins, totalMins, attendanceValue, 
            JSON.stringify([{ punch_in: currentPunchIn, punch_out: currentPunchOut }])
          );
          
          res.json({ status: 'success' });
          
};

export const legacyAttendancePlaceholder: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
};

export const bulkAttendanceV2Legacy: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
};

export const legacyGhostPunchesPlaceholder: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
};
