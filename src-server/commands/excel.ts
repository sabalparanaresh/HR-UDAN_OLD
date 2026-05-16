import ExcelJS from 'exceljs';
import path from 'path';
import fsModule from 'fs';
import { formulaEngine } from '../../src/utils/calculation/FormulaEngine.js';
import { CommandHandler } from './types.js';

export const distributeReport: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { reportName, base_table, module_type, target, targetPath, columns, calculatedCols = [], filters, sorts, author, user_id } = args;
          try {
            const db = module_type === 'P' ? statutoryDb : primaryDb;

            // Gather Data
            let selectCols = columns.map((c: any) => c.field === '*' ? '*' : `"${c.field.replace(/"/g, '""')}"`).join(', ');
            if (!selectCols) selectCols = '*';
            
            let query = `SELECT ${selectCols} FROM "${base_table.replace(/"/g, '""')}"`;
            const params: any[] = [];
            const whereClauses: string[] = [];
            
            if (filters && filters.length > 0) {
               filters.forEach((f: any) => {
                 const safeField = `"${f.field.replace(/"/g, '""')}"`;
                 if (f.operator === 'equals') {
                   whereClauses.push(`${safeField} = ?`);
                   params.push(f.value);
                 } else if (f.operator === 'contains') {
                   whereClauses.push(`${safeField} LIKE ?`);
                   params.push(`%${f.value}%`);
                 } else if (f.operator === 'gt') {
                   whereClauses.push(`${safeField} > ?`);
                   params.push(f.value);
                 } else if (f.operator === 'lt') {
                   whereClauses.push(`${safeField} < ?`);
                   params.push(f.value);
                 }
               });
            }
            if (whereClauses.length > 0) {
              query += ' WHERE ' + whereClauses.join(' AND ');
            }
            
            if (sorts && sorts.length > 0) {
              const orderBy = sorts.map((s: any) => `"${s.field.replace(/"/g, '""')}" ${s.direction === 'desc' ? 'DESC' : 'ASC'}`).join(', ');
              query += ' ORDER BY ' + orderBy;
            }

            const data = db.prepare(query).all(...params);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = author || 'HR-UDAN System';
            workbook.created = new Date();
            const worksheet = workbook.addWorksheet('Data');
            
            if (data.length > 0) {
              const headers = Object.keys(data[0]);
              worksheet.columns = headers.map(h => ({ header: h.toUpperCase(), key: h, width: Math.max(h.length + 5, 15) }));
              worksheet.addRows(data);
              worksheet.getRow(1).font = { bold: true };
            }
            
            const buffer = await workbook.xlsx.writeBuffer();
            
            // Log the distribution action to audit_logs
            let actionType = 'EX3000_EXCEL';
            let details = `Exported ${data.length} rows to EXCEL`;
            
            if (target === 'USB_COPY') {
                actionType = 'USB_COPY';
                details = `Copied ${reportName || 'report'} to USB Drive at ${targetPath || 'default port'}. Rows: ${data.length}`;
            } else if (target === 'LOCAL_FOLDER') {
                actionType = 'LOCAL_DELIVERY';
                details = `Delivered ${reportName || 'report'} to Local Folder at ${targetPath || 'Downloads'}. Rows: ${data.length}`;
            } else if (target === 'PRINT_PACKET') {
                actionType = 'PRINT_PACKET';
                details = `Generated Printable Packet for ${reportName}. Rows: ${data.length}`;
            } else if (target === 'BUNDLE') {
                actionType = 'EX3000_BUNDLE';
                details = `Generated Export Bundle for ${reportName}. Rows: ${data.length}`;
            }

            const logId = `adt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const auditDb = module_type === 'P' ? statutoryDb : primaryDb;
            auditDb.prepare(`
               INSERT INTO audit_logs (id, entity_type, entity_id, action, details, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(logId, 'reports', reportName || 'custom_report', actionType, details, user_id || 'system', new Date().toISOString());

            // If we are simulating saving to a specific path using Node fs (when running as Tauri backend)
            const resultStatus = 'success';
            let message = '';
            
            if (target === 'USB_COPY' || target === 'LOCAL_FOLDER') {
                try {
                    // fs and path imported at top
                    // We only save physically if targetPath is provided and valid, otherwise simulate successful copy for web preview
                    if (targetPath) {
                        const targetDir = typeof targetPath === 'string' ? path.dirname(targetPath) : '';
                        if (targetDir && fsModule.existsSync(targetDir)) {
                             fsModule.writeFileSync(targetPath, Buffer.from(buffer));
                             message = `Successfully saved to ${targetPath}`;
                        } else {
                             message = `Simulated save to ${targetPath} (Directory not accessible in web sandbox)`;
                        }
                    } else {
                         message = `Simulated delivery to ${target}`;
                    }
                } catch (e: any) {
                    message = `Simulated saving. (Real file write failed: ${e.message})`;
                }
            }
            
            // Return base64 payload as well
            res.json({ status: resultStatus, message, base64: Buffer.from(buffer).toString('base64'), recordCount: data.length, filename: (reportName || 'Export') + '.xlsx' });
          } catch (e: any) {
             console.error("Distribute Report Error:", e);
             res.status(500).json({ error: e.message });
          
}
};

export const generateEnterpriseExcel: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { reportName, base_table, module_type, columns, calculatedCols = [], filters, sorts, password, author } = args;
          
          try {
            const db = module_type === 'P' ? statutoryDb : primaryDb;

            // Gather Data
            let selectCols = columns.map((c: any) => c.field === '*' ? '*' : `"${c.field.replace(/"/g, '""')}"`).join(', ');
            if (!selectCols) selectCols = '*';
            
            let query = `SELECT ${selectCols} FROM "${base_table.replace(/"/g, '""')}"`;
            const params: any[] = [];
            const whereClauses: string[] = [];
            
            if (filters && filters.length > 0) {
               filters.forEach((f: any) => {
                 const safeField = `"${f.field.replace(/"/g, '""')}"`;
                 if (f.operator === 'equals') {
                   whereClauses.push(`${safeField} = ?`);
                   params.push(f.value);
                 } else if (f.operator === 'contains') {
                   whereClauses.push(`${safeField} LIKE ?`);
                   params.push(`%${f.value}%`);
                 } else if (f.operator === 'gt') {
                   whereClauses.push(`${safeField} > ?`);
                   params.push(f.value);
                 } else if (f.operator === 'lt') {
                   whereClauses.push(`${safeField} < ?`);
                   params.push(f.value);
                 } // other operators...
               });
            }
            if (whereClauses.length > 0) {
              query += ' WHERE ' + whereClauses.join(' AND ');
            }
            
            if (sorts && sorts.length > 0) {
              const orderBy = sorts.map((s: any) => `"${s.field.replace(/"/g, '""')}" ${s.direction === 'desc' ? 'DESC' : 'ASC'}`).join(', ');
              query += ' ORDER BY ' + orderBy;
            }

            const data = db.prepare(query).all(...params) as any[];

            if (calculatedCols && calculatedCols.length > 0) {
              for (const row of data) {
                for (const calc of calculatedCols) {
                  row[calc.field || calc.name] = formulaEngine.evaluate(calc.formula, row);
                }
              }
              // dynamically inject calculated fields into columns so they are exported
              for (const calc of calculatedCols) {
                if (!columns.find((c: any) => c.field === (calc.field || calc.name))) {
                  columns.push({ field: calc.field || calc.name });
                }
              }
            }

            const workbook = new ExcelJS.Workbook();
            workbook.creator = author || 'HR-UDAN System';
            workbook.lastModifiedBy = author || 'HR-UDAN System';
            workbook.created = new Date();
            
            if (password) {
              await (workbook as any).protect(password);
            }

            const sheet = workbook.addWorksheet(reportName || 'Report', {
              views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }], 
              properties: { tabColor: { argb: module_type === 'P' ? 'FF0000FF' : 'FF00FF00' } }
            });

            const headers = columns.map((c: any) => c.field);
            sheet.columns = columns.map((c: any) => ({
              header: c.field,
              key: c.field,
              width: Math.max(15, c.field.length + 5)
            }));

            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF1E3A8A' }
            };

            data.forEach((row: any) => {
              sheet.addRow(row);
            });

            // Audit Logging
            try {
                const authorVal = author || req.headers['x-user-id'] || 'system';
                const auditId = `AUD-${Date.now()}-EXCEL`;
                const details = JSON.stringify({
                    report_name: reportName || 'Unknown',
                    base_table: base_table,
                    rows_exported: data.length,
                    module: module_type,
                    filters_used: JSON.stringify(filters || []),
                    author: authorVal
                });
                db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
                    auditId, 1, 'EX3000_EXCEL', 'RE3000', base_table, details
                );
            } catch(auditErr) {
                 console.error("Audit log error:", auditErr);
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const base64Str = Buffer.from(buffer).toString('base64');

            res.json({ status: 'success', base64: base64Str, filename: `${reportName}_${Date.now()}.xlsx` });
          } catch(e: any) {
             console.error("Excel generation error:", e);
             res.status(500).json({ error: e.message });
          
}
};

export const generateSalaryRegisterExcel: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { month, module_type, author, password } = args;
          
          try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = author || 'HR-UDAN System';
            workbook.created = new Date();
            
            if (password) {
              await (workbook as any).protect(password);
            }

            const db = module_type === 'P' ? statutoryDb : primaryDb;

            // Fetch dynamic salary heads
            const salaryHeadsRaw = db.prepare('SELECT id, name, type FROM salary_heads WHERE status = 1 ORDER BY type, name').all() as any[];
            const earningHeads = salaryHeadsRaw.filter(h => h.type === 'EARNING');
            const deductionHeads = salaryHeadsRaw.filter(h => h.type === 'DEDUCTION');

            // Fetch payroll data
            const payrollData = db.prepare(`
               SELECT p.*, e.name as emp_name, e.emp_code as emp_code, d.name as department
               FROM final_payroll p
               LEFT JOIN employees e ON p.emp_id = e.id
               LEFT JOIN departments d ON e.department_id = d.id
               WHERE p.month_year = ?
            `).all(month) as any[];

            // --- Sheet 1: Detailed Register ---
            const detailSheet = workbook.addWorksheet('Salary Register', {
              views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }],
              properties: { tabColor: { argb: 'FF00B050' } }
            });

            // Grouping: build header rows
            const row1 = ['Department', 'Emp Code', 'Name', 'Basic Details', ''];
            const row2 = ['Department', 'Emp Code', 'Name', 'Days', 'Rate'];

            earningHeads.forEach(eh => { row1.push('Earnings'); row2.push(eh.name.substring(0, 15)); });
            row1.push('Earnings'); row2.push('Gross Earn');
            
            deductionHeads.forEach(dh => { row1.push('Deductions'); row2.push(dh.name.substring(0, 15)); });
            row1.push('Deductions'); row2.push('Total Ded');
            
            row1.push('Net Salary'); row2.push('Net Payable');

            detailSheet.addRow(row1);
            detailSheet.addRow(row2);

            // Merge header groups
            detailSheet.mergeCells(1, 1, 2, 1); // Dept
            detailSheet.mergeCells(1, 2, 2, 2); // Code
            detailSheet.mergeCells(1, 3, 2, 3); // Name
            detailSheet.mergeCells(1, 4, 1, 5); // Basic Details

            const earnStartCol = 6;
            const earnEndCol = 6 + earningHeads.length;
            if (earnStartCol <= earnEndCol) detailSheet.mergeCells(1, earnStartCol, 1, earnEndCol);

            const dedStartCol = earnEndCol + 1;
            const dedEndCol = dedStartCol + deductionHeads.length;
            if (dedStartCol <= dedEndCol) detailSheet.mergeCells(1, dedStartCol, 1, dedEndCol);
            
            detailSheet.mergeCells(1, dedEndCol + 1, 2, dedEndCol + 1); // Net

            // Style headers
            [1, 2].forEach(r => {
               const row = detailSheet.getRow(r);
               row.font = { bold: true };
               row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
               row.eachCell((cell: any) => {
                 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
                 cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
               });
            });

            // Add grouped data
            const rowIdx = 3;
            // Group by department
            const grouped = payrollData.reduce((acc, curr) => {
               const dept = curr.department || 'Unassigned';
               if(!acc[dept]) acc[dept] = [];
               acc[dept].push(curr);
               return acc;
            }, {} as Record<string, any[]>);

            for (const [dept, _emps] of Object.entries(grouped)) {
               const emps = _emps as any[];
               emps.forEach(emp => {
                  const dataRow = [
                     dept, emp.emp_code, emp.emp_name, 
                     module_type === 'P' ? emp.p_days_worked : emp.k_days_worked,
                     module_type === 'P' ? emp.p_base_wage : emp.k_base_wage
                  ];
                  // Pad earnings
                  earningHeads.forEach((eh: any) => dataRow.push(0)); // In real scenario: fetch from salary_breakups table
                  dataRow.push(module_type === 'P' ? emp.p_gross_statutory_payable : emp.k_gross_payable); // Gross
                  
                  // Pad deductions
                  deductionHeads.forEach((dh: any) => dataRow.push(0));
                  const totalDed = module_type === 'P' ? (emp.p_pf_deduction + emp.p_esi_deduction + emp.p_pt_deduction + emp.p_advance_deduction) : (emp.k_advance_deduction + emp.k_canteen_deduction);
                  dataRow.push(totalDed); // Total Ded

                  dataRow.push(module_type === 'P' ? emp.p_net_statutory_payable : emp.k_net_payable); // Net
                  
                  const row = detailSheet.addRow(dataRow);
                  
                  // Conditional Formatting for Net < 0
                  const netCell = row.getCell(dedEndCol + 1);
                  if (netCell.value && (netCell.value as number) < 0) {
                     netCell.font = { color: { argb: 'FFFF0000' } }; // Red
                  }
               });
            }

            detailSheet.getColumn(1).width = 15;
            detailSheet.getColumn(2).width = 12;
            detailSheet.getColumn(3).width = 25;

            // --- Sheet 2: Summary ---
            const summarySheet = workbook.addWorksheet('Summary by Dept', {
               properties: { tabColor: { argb: 'FFFFC000' } }
            });
            summarySheet.addRow(['Department', 'Total Emp', 'Total Gross', 'Total Deductions', 'Net Payable']);
            summarySheet.getRow(1).font = { bold: true };
            summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

            for (const [dept, _emps] of Object.entries(grouped)) {
               const emps = _emps as any[];
               const totGross = emps.reduce((sum, e) => sum + (module_type === 'P' ? e.p_gross_statutory_payable : e.k_gross_payable), 0);
               const totNet = emps.reduce((sum, e) => sum + (module_type === 'P' ? e.p_net_statutory_payable : e.k_net_payable), 0);
               const totDed = totGross - totNet;
               summarySheet.addRow([dept, emps.length, totGross, totDed, totNet]);
            }

            summarySheet.columns.forEach((col: any) => { col.width = 15; });

            // Audit logging
            db.prepare(`
               INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details)
               VALUES (?, ?, ?, ?, ?, ?)
            `).run(`AUD-${Date.now()}`, 1, 'EX3000_EXCEL', 'SALARY_REGISTER', month, JSON.stringify({ module_type }));

            const buffer = await workbook.xlsx.writeBuffer();
            const base64Str = Buffer.from(buffer).toString('base64');

            res.json({ status: 'success', base64: base64Str, filename: `Salary_Register_${month}_${module_type}.xlsx` });
          } catch(e: any) {
             console.error("Salary Register export error", e);
             res.status(500).json({ error: e.message });
          
}
};
