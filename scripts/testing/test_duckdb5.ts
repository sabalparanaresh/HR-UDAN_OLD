import duckdb from 'duckdb';

const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE);`, (err) => {
   if (err) console.error(err);
   else {
       analyticsDb.exec(`
              CREATE OR REPLACE TABLE primary_db_emp_snapshot AS 
              SELECT e.id, e.emp_code, e.name, e.status, d.name as department_name, ds.name as designation_name
              FROM primary_db.employees e
              LEFT JOIN primary_db.departments d ON e.department_id = d.id
              LEFT JOIN primary_db.designations ds ON e.designation_id = ds.id;
       `, (err) => {
           if (err) console.error("Create err:", err);
           else console.log("Created successfully");
       });
   }
});
