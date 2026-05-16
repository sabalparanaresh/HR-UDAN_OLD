import duckdb from 'duckdb';

const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE);`, (err) => {
   if(err) console.error(err);
   else {
       analyticsDb.all(`PRAGMA table_info('primary_db.employees')`, (err, res) => {
           console.log(res);
       });
   }
});
