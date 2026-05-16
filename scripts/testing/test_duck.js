import duckdb from 'duckdb';

const analyticsDb = new duckdb.Database(':memory:');

analyticsDb.exec("INSTALL sqlite; LOAD sqlite;", (err) => {
  if (err) console.error("DuckDB sqlite extension error:", err);
  else {
    analyticsDb.exec("ATTACH 'primary.db' AS primary_db (TYPE SQLITE);", (err) => {
      if(err) console.error("DuckDB attach primary:", err);
      else console.log("primary attached");
    });
    analyticsDb.exec("ATTACH 'statutory.db' AS statutory_db (TYPE SQLITE);", (err) => {
      if(err) console.error("DuckDB attach statutory:", err);
      else console.log("statutory attached");
    });
  }
});
