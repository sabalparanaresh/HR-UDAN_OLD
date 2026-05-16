import Database from 'better-sqlite3';
const primaryDb = new Database('primary.db');
const statutoryDb = new Database('statutory.db');

import { runPostSetupMigrations } from '../../src-server/db/migrations.js';
runPostSetupMigrations(primaryDb, statutoryDb);

import duckdb from 'duckdb';
const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE); ATTACH 'statutory.db' AS statutory_db (TYPE SQLITE);`, (err) => {
   if (err) console.error(err);
   else {
       const runQuery = (sql: string) => new Promise((resolve, reject) => {
           analyticsDb.all(sql, (err, rows) => {
               if(err) reject(err); else resolve(rows);
           })
       });

       Promise.all(['primary_db'].map(async (src) => {
           await runQuery(`
              CREATE OR REPLACE TABLE ${src}_emp_snapshot AS 
              SELECT e.id, e.emp_code, e.name, e.status, e.wage_type, 
                     e.department_id, e.designation_id, e.location_id, e.category_id, 
                     e.division_id, e.group_id, e.class_id, e.employment_type_id, e.shift_id,
                     d.name as department_name, ds.name as designation_name
              FROM ${src}.employees e
              LEFT JOIN ${src}.departments d ON e.department_id = d.id
              LEFT JOIN ${src}.designations ds ON e.designation_id = ds.id;
            `);
           console.log("Created", src);
       })).catch(console.error);
   }
});
