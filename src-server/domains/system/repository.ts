import { Database } from 'better-sqlite3';

export class SystemRepository {
    private primaryDb: Database;
    private statutoryDb: Database;

    constructor(primaryDb: Database, statutoryDb: Database) {
        this.primaryDb = primaryDb;
        this.statutoryDb = statutoryDb;
    }

    setConnectionStatus(status: 'CONNECTED' | 'DISCONNECTED', userId: string | null) {
        const dbStatus = status === 'DISCONNECTED' ? 'DISCONNECTED_AUDIT' : 'CONNECTED';
        
        // Update Primary DB
        this.primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
        this.primaryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, ?, CURRENT_TIMESTAMP, ?)`).run(dbStatus, userId);
        this.primaryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run(dbStatus, userId, 'Manual Toggle via Connection UI');

        // Update Statutory DB
        try {
            this.statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
            this.statutoryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, ?, CURRENT_TIMESTAMP, ?)`).run(dbStatus, userId);
            this.statutoryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run(dbStatus, userId, 'Manual Toggle via Connection UI');
        } catch (e) {
            console.warn('Failed to update connection status in statutory db');
        }
    }

    getConnectionStatus() {
        const bridgeRow = this.primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
        if (bridgeRow) {
            return bridgeRow.state === 'DISCONNECTED_AUDIT' ? 'DISCONNECTED' : 'CONNECTED';
        } else {
            const status = this.primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
            return status?.value || 'CONNECTED';
        }
    }

    getReconnectAuditLogs() {
        try {
            return this.primaryDb.prepare(`
              SELECT r.id, r.action, r.timestamp, r.reason, u.username as performed_by_user 
              FROM reconnect_audit_logs r 
              LEFT JOIN users u ON r.performed_by = u.id 
              ORDER BY r.timestamp DESC LIMIT 50
            `).all();
        } catch(e) {
            return [];
        }
    }

    reconcileKP() {
        try {
            const bridgeRow = this.primaryDb.prepare("SELECT state, updated_at FROM bridge_state WHERE id = 1").get() as any;
            if (!bridgeRow || bridgeRow.state !== 'DISCONNECTED_AUDIT') {
                return { k_count: 0, p_count: 0 };
            }

            const kCount = this.primaryDb.prepare("SELECT count(*) as c FROM attendance_logs WHERE created_at >= ?").get(bridgeRow.updated_at) as any;
            let pCount = {c: 0};
            try {
                pCount = this.statutoryDb.prepare("SELECT count(*) as c FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").get() as any;
            } catch(e) {}

            return {
                audit_start_time: bridgeRow.updated_at,
                k_records: kCount.c,
                p_records: pCount.c
            };
        } catch(e) {
            return { k_count: 0, p_count: 0 };
        }
    }

    resolveReconnect(resolution: string, userId: string | null) {
        const bridgeRow = this.primaryDb.prepare("SELECT state, updated_at FROM bridge_state WHERE id = 1").get() as any;
        if (!bridgeRow || bridgeRow.state !== 'DISCONNECTED_AUDIT') {
            throw new Error('Not in disconnected state');
        }

        if (resolution === 'KEEP_K') {
            try { this.statutoryDb.prepare("DELETE FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").run(); } catch(e) {}
            try { this.statutoryDb.prepare("DELETE FROM wage_attendance_transactions WHERE origin = 'P_AUDIT_MODE'").run(); } catch(e) {}
        } else if (resolution === 'KEEP_P') {
            try {
                const pAtt = this.statutoryDb.prepare("SELECT * FROM attendance_logs WHERE origin = 'P_AUDIT_MODE'").all() as any[];
                for (const r of pAtt) {
                    this.primaryDb.prepare("INSERT OR IGNORE INTO attendance_logs (emp_id, date, punch_in, punch_out, attendance_value, status, origin) VALUES (?, ?, ?, ?, ?, ?, 'K_NORMAL')")
                      .run(r.emp_id, r.date, r.punch_in, r.punch_out, r.attendance_value, r.status);
                }
            } catch(e) {}
        } else if (resolution === 'DUAL_LEDGER') {
            // Do nothing
        }

        this.primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', 'CONNECTED')").run();
        this.primaryDb.prepare(`INSERT OR REPLACE INTO bridge_state (id, state, updated_at, updated_by) VALUES (1, 'CONNECTED', CURRENT_TIMESTAMP, ?)`).run(userId);
        this.primaryDb.prepare(`INSERT INTO reconnect_audit_logs (action, performed_by, reason) VALUES (?, ?, ?)`).run('CONNECTED', userId, `Reconnected with resolution: ${resolution}`);

        try {
            this.statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', 'CONNECTED')").run();
        } catch (e) {}
    }
}
