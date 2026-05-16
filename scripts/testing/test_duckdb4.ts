import duckdb from 'duckdb';

const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE);`, (err) => {
   if (err) console.error(err);
   else {
       analyticsDb.all(`SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'`, (err, res) => {
           console.log("COLUMNS", res);
       });
   }
});
