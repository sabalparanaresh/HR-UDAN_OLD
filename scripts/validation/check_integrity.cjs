const Database = require('better-sqlite3');
try {
  const db = new Database('statutory.db', { fileMustExist: true });
  console.log("Integrity Check:", db.pragma('integrity_check', { simple: false }));
} catch(e) {
  console.error("error:", e);
}
