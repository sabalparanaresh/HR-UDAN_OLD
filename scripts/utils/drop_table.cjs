const db = require('better-sqlite3')('primary.db');
db.exec('DROP TABLE IF EXISTS sync_queue');
