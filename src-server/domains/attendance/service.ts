import { AttendanceBulkProcessor } from '../../services/AttendanceBulkProcessor.js';
import { emitEvent } from '../../services/sse.js';
import { isKConnected } from '../../utils/syncCircuitBreaker.js';

export class AttendanceService {
  private primaryDb: any;
  private statutoryDb: any;

  constructor(primaryDb: any, statutoryDb: any) {
    this.primaryDb = primaryDb;
    this.statutoryDb = statutoryDb;
  }

  public async getLogs(filters: any, moduleType: 'K' | 'P') {
    const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    
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

    return db.prepare(sql).all(...params);
  }

  public async saveManualAttendance(data: any, moduleType: 'K' | 'P') {
    const { empId, date, punchIn, punchOut, shiftId } = data;
    const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    
    let workedMins = 0;
    let totalMins = 0;
    if (punchIn && punchOut) {
      const start = new Date(punchIn);
      const end = new Date(punchOut);
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
      empId, date, punchIn, punchOut, shiftId, 
      attendanceValue > 0 ? 'PRESENT' : 'ABSENT',
      workedMins, totalMins, attendanceValue, 
      JSON.stringify([{ punch_in: punchIn, punch_out: punchOut }])
    );
  }

  public async processAttendance(fromDate: string, toDate: string, moduleType: 'K' | 'P') {
    const shiftDb = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    
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

    const updateStmt = db.prepare('UPDATE attendance_logs SET worked_mins = ?, total_time_mins = ?, outside_mins = ?, attendance_value = ? WHERE id = ?');

    db.transaction(() => {
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
        } catch (e) {}

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

        updateStmt.run(workedMins, totalTimeMins, outsideMins, attendanceValue, log.id);
      }
    })();
  }

  public async bulkGenerateV2(fromDate: string, toDate: string, filters: any, dbPath: string) {
    emitEvent('bulk-attendance-progress', { processed: 0, total: 100, percentage: 0 });

    const processor = AttendanceBulkProcessor.getInstance();
    
    processor.generateBulk(
      dbPath,
      fromDate,
      toDate,
      filters,
      (progress) => {
        emitEvent('bulk-attendance-progress', progress);
      },
      (result) => {
        emitEvent('bulk-attendance-complete', result);
      },
      (err) => {
        emitEvent('bulk-attendance-error', { error: err.message || String(err) });
      }
    );
  }

  public async cancelBulkGeneration() {
    const processor = AttendanceBulkProcessor.getInstance();
    if (processor.getActiveStatus()) {
      processor.cancel();
    }
  }

  public async fetchBiometricLogs(moduleType: 'K' | 'P') {
    const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    const config = db.prepare('SELECT * FROM company_config LIMIT 1').get() as any;
    if (!config) {
      throw new Error('Company configuration not found.');
    }
    
    // Simulating biometrics based on original implementation
    return [
      { emp_id: 1, punch_time: new Date().toISOString(), type: 'IN' },
      { emp_id: 2, punch_time: new Date().toISOString(), type: 'IN' }
    ];
  }

  public async saveBiometricLogs(logs: any[], moduleType: 'K' | 'P') {
    const db = moduleType === 'P' ? this.statutoryDb : this.primaryDb;
    
    const grouped: Record<string, any[]> = {};
    for (const rawLog of logs) {
      const date = rawLog.punch_time.split('T')[0];
      const key = `${rawLog.emp_code}_${date}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(rawLog);
    }

    let savedCount = 0;
    
    db.transaction(() => {
      for (const key in grouped) {
        const [empCode, date] = key.split('_');
        const empPunches = grouped[key].sort((a, b) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
        
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
    })();

    return { status: 'success', savedCount };
  }

  public async resolveAnomalies() {
    let anomaliesFound = 0;
    let anomaliesFixed = 0;
    
    const logs = this.statutoryDb.prepare("SELECT * FROM attendance_logs ORDER BY emp_id, punch_in").all() as any[];
    let prevLog: any = null;

    this.statutoryDb.transaction(() => {
      for (const log of logs) {
        if (!log.punches || log.punches === '[]') continue;

        let punchesArr: any[] = [];
        try {
            punchesArr = JSON.parse(log.punches);
        } catch(e) { continue; }
        
        let originalPunches = [...punchesArr];
        let changed = false;
        let anomalyType = null;
        let severity = null;
        let quarantine = false;

        if (punchesArr.length > 0) {
            const sorted = punchesArr.map((p: any) => new Date(p.timestamp || p.time || p).getTime()).filter((t:any) => !isNaN(t)).sort();
            const uniquePunches = [];
            let duplicateFound = false;

            for (let i = 0; i < sorted.length; i++) {
                if (i === 0) {
                    uniquePunches.push(sorted[i]);
                } else {
                    if (sorted[i] - sorted[i-1] > 5 * 60 * 1000) {
                        uniquePunches.push(sorted[i]);
                    } else {
                        duplicateFound = true;
                    }
                }
            }

            if (duplicateFound) {
                anomalyType = 'DUPLICATE_PUNCHES';
                severity = 'LOW';
                changed = true;
                punchesArr = uniquePunches.map((p) => ({ timestamp: new Date(p).toISOString() }));
                if (punchesArr.length > 0) {
                   log.punch_in = punchesArr[0].timestamp;
                   log.punch_out = punchesArr.length > 1 ? punchesArr[punchesArr.length - 1].timestamp : log.punch_out;
                }
            }
        }

        if (punchesArr.length === 1 && !log.punch_in && log.punch_out) {
            anomalyType = 'ORPHAN_OUT_PUNCH';
            severity = 'MEDIUM';
            quarantine = true;
            changed = true;
            log.punch_out = null; 
            punchesArr = [];
        }

        if (log.punch_in && log.punch_out) {
            const t1 = new Date(log.punch_in).getTime();
            const t2 = new Date(log.punch_out).getTime();
            if (t2 - t1 > 16 * 60 * 60 * 1000) {
                anomalyType = 'EXCESSIVE_HOURS_16';
                severity = 'HIGH';
                quarantine = true;
            }
        }

        if (prevLog && prevLog.emp_id === log.emp_id && prevLog.punch_in && log.punch_in && prevLog.punch_out) {
            const prevT2 = new Date(prevLog.punch_out).getTime();
            const curT1 = new Date(log.punch_in).getTime();
            if (curT1 < prevT2) {
                anomalyType = 'OVERLAPPING_SHIFT';
                severity = 'HIGH';
                quarantine = true;
            }
        }

        if (anomalyType) {
            anomaliesFound++;
            this.statutoryDb.prepare(`
              INSERT INTO p_attendance_anomalies (emp_id, date, punch_in, punch_out, punches, anomaly_type, severity)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(log.emp_id, log.date, log.punch_in, log.punch_out, JSON.stringify(originalPunches), anomalyType, severity);
            
            if (changed) {
                this.statutoryDb.prepare("UPDATE attendance_logs SET punches = ?, punch_in = ?, punch_out = ? WHERE id = ?")
                  .run(JSON.stringify(punchesArr), log.punch_in, log.punch_out, log.id);
                anomaliesFixed++;
            }
            if (quarantine) {
                this.statutoryDb.prepare("UPDATE attendance_logs SET blacklist_status = 1 WHERE id = ?").run(log.id);
            }
        }
        prevLog = log;
      }
    })();

    return { success: true, anomalies_found: anomaliesFound, anomalies_fixed: anomaliesFixed };
  }
}
