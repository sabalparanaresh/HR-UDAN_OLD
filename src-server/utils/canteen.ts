import Database from 'better-sqlite3';

export const recalculateCanteenRules = (db: Database.Database, empId?: number) => {
  try {
    const rules = db.prepare("SELECT * FROM canteen_rules WHERE effective_date IS NULL OR effective_date <= date('now', 'localtime')").all() as any[];
    
    // Sort rules by Priority: Designation > Department > Group > Category > Default Rule
    rules.sort((a, b) => {
      const getScore = (rule: any) => {
        let score = 0;
        try { if (JSON.parse(rule.designations || '[]').length > 0) score += 10000; } catch(e){}
        try { if (JSON.parse(rule.departments || '[]').length > 0) score += 1000; } catch(e){}
        try { if (JSON.parse(rule.groups || '[]').length > 0) score += 100; } catch(e){}
        try { if (JSON.parse(rule.categories || '[]').length > 0) score += 10; } catch(e){}
        try { if (JSON.parse(rule.classes || '[]').length > 0) score += 1; } catch(e){}
        return score;
      };
      return getScore(b) - getScore(a); // High score first
    });

    let q = 'SELECT id, class_id, category_id, group_id, department_id, designation_id FROM employees WHERE status = 1';
    let params: any[] = [];
    if (empId) {
      q += ' AND id = ?';
      params.push(empId);
    }
    const employees = db.prepare(q).all(...params) as any[];
    
    // We only update those without manual overrides
    const upsertStmt = db.prepare(`
      INSERT INTO canteen_employee_benefits (emp_id, rule_id, benefit_type, is_manual_override, rate_override)
      VALUES (?, ?, ?, 0, NULL)
      ON CONFLICT(emp_id) DO UPDATE SET 
        rule_id = excluded.rule_id,
        benefit_type = excluded.benefit_type
      WHERE is_manual_override = 0
    `);

    db.transaction(() => {
      // Clear out automatic ones
      if (empId) {
         db.prepare('DELETE FROM canteen_employee_benefits WHERE is_manual_override = 0 AND emp_id = ?').run(empId);
      } else {
         db.prepare('DELETE FROM canteen_employee_benefits WHERE is_manual_override = 0').run();
      }
      
      for (const emp of employees) {
        let matchedRule = null;
        for (const rule of rules) {
          let classes: number[] = [];
          let categories: number[] = [];
          let groups: number[] = [];
          let depts: number[] = [];
          let desigs: number[] = [];
          try { classes = JSON.parse(rule.classes || '[]'); } catch(e){}
          try { categories = JSON.parse(rule.categories || '[]'); } catch(e){}
          try { groups = JSON.parse(rule.groups || '[]'); } catch(e){}
          try { depts = JSON.parse(rule.departments || '[]'); } catch(e){}
          try { desigs = JSON.parse(rule.designations || '[]'); } catch(e){}
          
          let matches = true;
          // If a criteria array is defined, employee must match it to be considered
          if (classes.length && !classes.includes(emp.class_id)) matches = false;
          if (categories.length && !categories.includes(emp.category_id)) matches = false;
          if (groups.length && !groups.includes(emp.group_id)) matches = false;
          if (depts.length && !depts.includes(emp.department_id)) matches = false;
          if (desigs.length && !desigs.includes(emp.designation_id)) matches = false;
          
          if (matches) {
            matchedRule = rule;
            break; // Since sorted by descending priority, the first match is the best
          }
        }
        
        if (matchedRule) {
          upsertStmt.run(emp.id, matchedRule.id, matchedRule.benefit_type);
        }
      }
    })();
  } catch (err) {
    console.error("[Canteen Engine] Rule recalculation failed:", err);
  }
};

