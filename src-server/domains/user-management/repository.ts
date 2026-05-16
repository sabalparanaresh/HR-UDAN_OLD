import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface User {
    id: number;
    name: string;
    username: string;
    role_id: number;
    role_name?: string;
    status: string;
    login_attempts: number;
    is_locked: number;
    lock_until: string | null;
    mobile_number: string | null;
    birth_date: string | null;
    secret_question_1: string | null;
    secret_question_2: string | null;
    created_at: string;
}

export interface Role {
    id: number;
    name: string;
    description: string;
    is_system: number;
    module_scope: string;
    created_at: string;
}

export interface RolePermission {
    id: number;
    role_id: number;
    module: string;
    menu_group: string;
    page_key: string;
    can_view: number;
    can_insert: number;
    can_edit: number;
    can_delete: number;
}

export class UserManagementRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    // --- USERS ---
    getUsers(): User[] {
        return this.db.prepare(`
            SELECT u.id, u.name, u.username, u.role_id, r.name as role_name, u.status, u.login_attempts, 
                   u.is_locked, u.lock_until, u.mobile_number, u.birth_date,
                   u.secret_question_1, u.secret_question_2, u.created_at
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        `).all() as User[];
    }

    getUserById(id: number): User | undefined {
        return this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User;
    }

    getUserByUsername(username: string): User | undefined {
        return this.db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as User;
    }

    createUser(data: any): number {
        const info = this.db.prepare(`
            INSERT INTO users (name, username, password_hash, password, role_id, status, mobile_number, birth_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data.name, data.username, data.password_hash || data.password, data.password, data.role_id, data.status || 'ACTIVE', data.mobile_number, data.birth_date);
        return info.lastInsertRowid as number;
    }

    updateUser(id: number, data: any) {
        let sql = `UPDATE users SET 
            name = COALESCE(?, name),
            username = COALESCE(?, username),
            role_id = COALESCE(?, role_id),
            status = COALESCE(?, status),
            mobile_number = ?,
            birth_date = ?`;
        const params: any[] = [data.name, data.username, data.role_id, data.status, data.mobile_number, data.birth_date];

        if (data.password_hash || data.password) {
            sql += `, password_hash = ?, password = ?`;
            params.push(data.password_hash || data.password, data.password);
        }

        sql += ` WHERE id = ?`;
        params.push(id);

        this.db.prepare(sql).run(...params);
    }

    deleteUser(id: number) {
        this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    }

    // --- ROLES ---
    getRoles(): Role[] {
        return this.db.prepare(`SELECT * FROM roles ORDER BY id ASC`).all() as Role[];
    }

    getRoleById(id: number): Role | undefined {
        return this.db.prepare(`SELECT * FROM roles WHERE id = ?`).get(id) as Role;
    }
    
    getRoleByName(name: string): Role | undefined {
        return this.db.prepare(`SELECT * FROM roles WHERE name = ?`).get(name) as Role;
    }

    createRole(data: any): number {
        const info = this.db.prepare(`
            INSERT INTO roles (name, description, is_system, module_scope)
            VALUES (?, ?, ?, ?)
        `).run(data.name, data.description, data.is_system || 0, data.module_scope || 'BOTH');
        return info.lastInsertRowid as number;
    }

    updateRole(id: number, data: any) {
        this.db.prepare(`
            UPDATE roles SET name = ?, description = ?, module_scope = ? WHERE id = ? AND is_system = 0
        `).run(data.name, data.description, data.module_scope, id);
    }

    deleteRole(id: number) {
        this.db.prepare(`DELETE FROM roles WHERE id = ? AND is_system = 0`).run(id);
    }

    // --- PERMISSIONS ---
    getRolePermissions(roleId: number): RolePermission[] {
        return this.db.prepare(`SELECT * FROM role_permissions WHERE role_id = ?`).all(roleId) as RolePermission[];
    }

    updateRolePermissions(roleId: number, permissions: any[]) {
        this.db.transaction(() => {
            this.db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).run(roleId);
            const stmt = this.db.prepare(`
                INSERT INTO role_permissions (role_id, module, menu_group, page_key, can_view, can_insert, can_edit, can_delete)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const p of permissions) {
                stmt.run(roleId, p.module, p.menu_group, p.page_key, p.can_view ? 1 : 0, p.can_insert ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0);
            }
        })();
    }

    // --- AUDIT LOGS ---
    getAuditLogs() {
        return this.db.prepare(`
            SELECT * FROM audit_logs 
            WHERE entity = 'USER_MANAGEMENT' 
            ORDER BY created_at DESC 
            LIMIT 100
        `).all();
    }

    logAudit(action: string, entityId: string, details: string, user: string = 'system') {
        try {
            this.db.prepare(`
                INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), user, action, 'USER_MANAGEMENT', entityId, details);
        } catch (e) {
            console.error('Failed to write audit log', e);
        }
    }
}
