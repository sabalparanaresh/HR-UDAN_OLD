import Database from 'better-sqlite3';
const db = new Database('primary.db');
console.log(db.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get());
