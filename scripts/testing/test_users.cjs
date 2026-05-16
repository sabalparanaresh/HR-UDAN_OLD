import Database from 'better-sqlite3';
const db = new Database('primary.db');
console.log(db.prepare('SELECT id, username, role_id, (SELECT name FROM roles WHERE id=role_id) as role FROM users').all());
console.log(db.prepare('SELECT id, name FROM roles').all());
