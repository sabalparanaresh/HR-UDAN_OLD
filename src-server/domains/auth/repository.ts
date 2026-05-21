import { Database } from 'better-sqlite3';

export class AuthRepository {
    private db: Database;
    constructor(db: Database) {
        this.db = db;
    }
    
    getUserByUsername(username: string) {
        return this.db.prepare(`
            SELECT u.id, u.username, u.name, u.password_hash as password, 
                   u.role_id, r.name as role_name, r.module_scope, u.is_hidden_superadmin 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.username = ?
        `).get(username) as any;
    }

    getBridgeState() {
        return this.db.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
    }

    getRolePermissions(roleId: number) {
        return this.db.prepare('SELECT * FROM role_permissions WHERE role_id = ?').all(roleId) as any[];
    }

    getUserByVerificationInfo(mobile: string, birthDate: string, answer1: string, answer2: string) {
        return this.db.prepare(
            'SELECT id FROM users WHERE mobile_number = ? AND birth_date = ? AND secret_answer_1 = ? AND secret_answer_2 = ?'
        ).get(mobile, birthDate, answer1, answer2) as any;
    }

    createPasswordResetToken(userId: number, token: string, expiresAt: string) {
        this.db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
    }
    
    getTokenRecord(token: string) {
        return this.db.prepare('SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ? AND is_used = 0').get(token) as any;
    }
    
    updatePassword(userId: number, hash: string) {
        this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    }
    
    markTokenUsed(token: string) {
        this.db.prepare('UPDATE password_reset_tokens SET is_used = 1 WHERE token = ?').run(token);
    }
}
