import duckdb from 'duckdb';

const analyticsDb = new duckdb.Database(':memory:');
analyticsDb.exec(`INSTALL sqlite; LOAD sqlite; ATTACH 'primary.db' AS primary_db (TYPE SQLITE);`, (err) => {
   if (err) console.error(err);
   else {
       analyticsDb.all(`SELECT * FROM primary_db.employees LIMIT 1`, (err, res) => {
           console.log("ROWS", res?.length);
           if (res && res.length > 0) {
               console.log(Object.keys(res[0]));
           } else {
               console.log("No rows");
           }
       });
   }
});
