import { Database } from 'better-sqlite3';

/**
 * Log an error to the system_logs table.
 * @param db The SQLite database instance (primaryDb or statutoryDb)
 * @param level Log level (INFO, WARN, ERROR, FATAL)
 * @param message Human-readable message
 * @param error Optional error object to extract stack trace from
 */
export function logError(db: Database, level: string, message: string, error?: any) {
  try {
    const stack = error instanceof Error ? error.stack : (typeof error === 'string' ? error : null);
    db.prepare('INSERT INTO system_logs (level, message, stack) VALUES (?, ?, ?)')
      .run(level, message, stack);
    
    // Also log to console for visibility during development
    console.log(`[${level}] ${message}`, error || '');
  } catch (logErr) {
    console.error('CRITICAL: Failed to write to system_logs table:', logErr);
    console.error(`Original Error: [${level}] ${message}`, error || '');
  }
}
