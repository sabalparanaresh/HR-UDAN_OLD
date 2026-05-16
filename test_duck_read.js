import duckdb from 'duckdb';
const db = new duckdb.Database(':memory:');
db.exec("INSTALL sqlite; LOAD sqlite;", (err) => {
  db.exec("ATTACH 'statutory.db' AS statutory_db (TYPE SQLITE);", (err) => {
    if(err) { console.error("Attach Error", err); return; }
    db.all("SELECT count(*) FROM statutory_db.sqlite_master;", (err, rows) => {
      console.log("sqlite_master:", err || rows);
    });
  });
});
