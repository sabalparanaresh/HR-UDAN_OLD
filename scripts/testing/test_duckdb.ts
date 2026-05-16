import Database from 'better-sqlite3';
const db = new Database('primary.db');
db.exec('DROP TRIGGER IF EXISTS trg_audit_employees_insert');
db.exec('DROP TRIGGER IF EXISTS trg_audit_employees_update');
db.exec('DROP TRIGGER IF EXISTS trg_audit_employees_delete');

import duckdb from 'duckdb';
const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE);`, (err) => {
   if(err) console.error(err);
   else console.log('success attached after drop');
});
