
import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';
import { DbEmployee, DbAttendanceLog } from '../../src-server/types/index.js';

const { date, mode, type, monthYear, employeeList } = workerData;

const MAX_PROCESSABLE_RECORDS = 5000;

function isValidDateParts(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  const days = new Date(y, m, 0).getDate();
  return d >= 1 && d <= days;
}

try {
  const dbName = mode === 'P' ? "statutory.db" : "primary.db";
  const db = new Database(dbName);
  
  // Connection Health Check
  try {
    db.prepare('SELECT 1').get();
  } catch (e) {
    parentPort?.postMessage({ success: false, error: 'DB_CONNECTION_ERROR', details: `Could not connect to ${dbName}` });
    process.exit(1);
  }

  db.pragma('journal_mode = WAL');

  if (type === 'GENERATE_GHOST_PUNCHES') {
    // 1. Get holidays and weekly off for the month
    const holidays = db.prepare("SELECT date FROM holidays WHERE status = 1").all() as any[];
    const holidaySet = new Set(holidays.map(h => h.date));
    
    // 2. Parse monthYear
    const [month, year] = monthYear.split('-').map(Number);
    if (!month || !year || month < 1 || month > 12) {
      throw new Error(`Invalid month/year provided: ${monthYear}`);
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // 3. Get shifts and their rules
    const shifts = db.prepare("SELECT id, rules, start_time, end_time FROM shifts").all() as any[];
    const shiftMap = new Map();
    shifts.forEach(s => {
      try {
        s.parsedRules = typeof s.rules === 'string' ? JSON.parse(s.rules) : (s.rules || []);
      } catch (e) {
        s.parsedRules = [];
      }
      shiftMap.set(s.id, s);
    });

    const rawEmps = (employeeList || db.prepare("SELECT id, emp_code, name, shift_id FROM employees WHERE status = 1").all()) as DbEmployee[];
    const emps = rawEmps.slice(0, MAX_PROCESSABLE_RECORDS);

    db.transaction(() => {
      for (const emp of emps) {
        if (!emp.shift_id) continue;
        const shift = shiftMap.get(emp.shift_id);
        if (!shift) continue;

        // Find a rule that gives 1.0 attendance
        const fullDayRule = shift.parsedRules.find((r: any) => r.attendanceValue === 1.0);
        if (!fullDayRule) continue;

        const minWorkedMins = (fullDayRule.fromHours || 0) * 60 + (fullDayRule.fromMinutes || 0);
        const maxWorkedMins = (fullDayRule.toHours || 0) * 60 + (fullDayRule.toMinutes || 0);
        
        // We want to generate punches that result in workedMins >= minWorkedMins
        // Let's aim for (minWorkedMins + 30) or shift duration if it fits.
        const targetMins = Math.min(minWorkedMins + 30, (shift.total_working_hours || 8) * 60);

        for (let day = 1; day <= daysInMonth; day++) {
          if (!isValidDateParts(year, month, day)) continue;
          const currentDate = new Date(year, month - 1, day);
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          // Skip if Sunday or Holiday
          if (currentDate.getDay() === 0) continue;
          if (holidaySet.has(dateStr)) continue;

          // Generate a random shift start around shift.start_time
          const [sH, sM] = (shift.start_time || "09:00").split(':').map(Number);
          const randomOffset = Math.floor(Math.random() * 20) - 10; // +/- 10 mins
          const inTime = new Date(year, month - 1, day, sH, sM + randomOffset);
          const outTime = new Date(inTime.getTime() + targetMins * 60000);

          const punchIn = inTime.toISOString();
          const punchOut = outTime.toISOString();
          const punches = JSON.stringify([{ punch_in: punchIn, punch_out: punchOut }]);

          db.prepare(`
            INSERT OR REPLACE INTO attendance_logs (
              emp_id, emp_code, emp_name, date, punch_in, punch_out, 
              shift_id, shift_name, status, machine_name, 
              worked_mins, total_time_mins, attendance_value, punches
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRESENT', 'GHOST_GENERATOR', ?, ?, 1.0, ?)
          `).run(
            emp.id, emp.emp_code, emp.name, dateStr, punchIn, punchOut,
            shift.id, shift.name, targetMins, targetMins, punches
          );
        }
      }
    })();

    db.close();
    parentPort?.postMessage({ success: true });
  } else {
    // Standard attendance processing
    // 1. Get all active employees
    const rawEmployees = db.prepare("SELECT * FROM employees WHERE status = 1").all() as DbEmployee[];
    const employees = rawEmployees.slice(0, MAX_PROCESSABLE_RECORDS);
    
    // Pre-fetch shifts
    const allShifts = db.prepare("SELECT * FROM shifts").all() as any[];
    const shiftMap = new Map();
    allShifts.forEach((s: any) => {
      try {
        s.parsedRules = typeof s.rules === 'string' ? JSON.parse(s.rules) : (s.rules || []);
      } catch (e) {
        s.parsedRules = [];
      }
      shiftMap.set(s.id, s);
    });

    // Helper functions for shift history
    const getHistoricalShift = db.prepare(`
      SELECT shift_id FROM employee_shift_history
      WHERE emp_id = ? AND date(effective_from) <= ?
      ORDER BY effective_from DESC LIMIT 1
    `);
    
    // Check existing transactions to prevent recalculating with new shift settings
    const getExistingTransaction = db.prepare(`SELECT shift_id FROM wage_attendance_transactions WHERE emp_id = ? AND date = ?`);

    const results: any[] = [];

    // 2. Perform heavy calculations OUTSIDE the transaction
    for (const emp of employees as any[]) {
      // Find effective shift
      let effectiveShiftId = emp.shift_id;
      
      const existingTx = getExistingTransaction.get(emp.id, date) as any;
      if (existingTx && existingTx.shift_id) {
        // Immutability: Use the shift that was originally applied
        effectiveShiftId = existingTx.shift_id;
      } else {
         // Try to find historical shift
         const hist = getHistoricalShift.get(emp.id, date) as any;
         if (hist && hist.shift_id) {
           effectiveShiftId = hist.shift_id;
         }
      }

      if (!effectiveShiftId) continue;

      const shift = shiftMap.get(effectiveShiftId);
      if (!shift) continue;
      const rules = shift.parsedRules;
      
      const firstPunch = db.prepare(`
        SELECT * FROM biometric_logs 
        WHERE emp_code = ? AND date(punch_time) = ?
        ORDER BY punch_time ASC LIMIT 1
      `).get(emp.emp_code, date) as any;

      if (!firstPunch) {
        results.push({
          type: 'ABSENT',
          empId: emp.id,
          date,
          shiftId: effectiveShiftId
        });
        continue;
      }

      const logs = db.prepare(`
        SELECT * FROM biometric_logs 
        WHERE emp_code = ? 
        AND punch_time >= ? 
        AND punch_time <= datetime(?, '+30 hours')
        ORDER BY punch_time ASC
      `).all(emp.emp_code, firstPunch.punch_time, firstPunch.punch_time) as any[];

      let totalWorkedMins = 0;
      let isMissedPunch = false;
      const pairs: { in: string | null, out: string | null, mins: number, isMissed: boolean }[] = [];

      let lastIn: any = null;
      for (const log of logs) {
        if (log.punch_type === 'IN') {
          if (lastIn) {
            pairs.push({ in: lastIn.punch_time, out: null, mins: 0, isMissed: true });
            isMissedPunch = true;
          }
          lastIn = log;
        } else if (log.punch_type === 'OUT') {
          if (lastIn) {
            const inTime = new Date(lastIn.punch_time);
            const outTime = new Date(log.punch_time);
            const diff = Math.max(0, Math.floor((outTime.getTime() - inTime.getTime()) / (1000 * 60)));
            pairs.push({ in: lastIn.punch_time, out: log.punch_time, mins: diff, isMissed: false });
            totalWorkedMins += diff;
            lastIn = null;
          } else {
            pairs.push({ in: null, out: log.punch_time, mins: 0, isMissed: true });
            isMissedPunch = true;
          }
        }
      }
      if (lastIn) {
        pairs.push({ in: lastIn.punch_time, out: null, mins: 0, isMissed: true });
        isMissedPunch = true;
      }

      const firstIn = logs[0].punch_time;
      const lastOut = logs[logs.length - 1].punch_time;
      const totalTimeMins = Math.floor((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / (1000 * 60));
      const outsideMins = Math.max(0, totalTimeMins - totalWorkedMins);

      let attendanceValue = 0;
      let matchedRule = false;
      for (const rule of rules) {
        const ruleFromTotalMins = (rule.fromHours || 0) * 60 + (rule.fromMinutes || 0);
        const ruleToTotalMins = (rule.toHours || 0) * 60 + (rule.toMinutes || 0);

        if (totalWorkedMins >= ruleFromTotalMins && totalWorkedMins < ruleToTotalMins) {
          attendanceValue = rule.attendanceValue;
          matchedRule = true;
          break;
        }
      }
      
      if (!matchedRule && rules.length > 0) {
        const lastRule = rules[rules.length - 1];
        const lastRuleToMins = (lastRule.toHours || 0) * 60 + (lastRule.toMinutes || 0);
        if (totalWorkedMins >= lastRuleToMins) {
          attendanceValue = lastRule.attendanceValue;
        }
      }

      results.push({
        type: 'PROCESSED',
        empId: emp.id,
        date,
        firstIn,
        lastOut,
        totalTimeMins,
        workedMins: totalWorkedMins,
        outsideMins,
        shiftId: effectiveShiftId,
        attendanceValue,
        isMissedPunch,
        pairs
      });
    }

    const CHUNK_SIZE = 50;
    const insertTransaction = db.prepare(`
      INSERT OR REPLACE INTO wage_attendance_transactions (
        emp_id, date, punch_in, punch_out, total_time_mins, worked_mins, outside_mins, 
        shift_id, attendance_value, status, is_missed_punch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertAbsent = db.prepare(`
      INSERT OR REPLACE INTO wage_attendance_transactions (emp_id, date, shift_id, attendance_value, status)
      VALUES (?, ?, ?, ?, ?)
    `);
   
    const deletePunches = db.prepare("DELETE FROM attendance_punches WHERE attendance_transaction_id = ?");
    const insertPunch = db.prepare(`
      INSERT INTO attendance_punches (attendance_transaction_id, punch_in, punch_out, worked_mins, is_missed)
      VALUES (?, ?, ?, ?, ?)
    `);
   
    for (let i = 0; i < results.length; i += CHUNK_SIZE) {
      const chunk = results.slice(i, i + CHUNK_SIZE);
      const persistBatch = db.transaction((batch) => {
        for (const item of batch) {
          if (item.type === 'ABSENT') {
            insertAbsent.run(item.empId, item.date, item.shiftId, 0, 'Absent');
          } else {
            const res = insertTransaction.run(
              item.empId, item.date, item.firstIn, item.lastOut, item.totalTimeMins, 
              item.workedMins, item.outsideMins, item.shiftId, item.attendanceValue, 
              'Processed', item.isMissedPunch ? 1 : 0
            );
            const transactionId = res.lastInsertRowid;
            deletePunches.run(transactionId);
            for (const p of item.pairs) {
              insertPunch.run(transactionId, p.in, p.out, p.mins, p.isMissed ? 1 : 0);
            }
          }
        }
      });
      persistBatch(chunk);
    }
   
    db.close();
    parentPort?.postMessage({ success: true });
  }
} catch (error: any) {
  parentPort?.postMessage({ success: false, error: error.message });
}
