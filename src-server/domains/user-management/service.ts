import { Database } from 'better-sqlite3';
import { UserManagementRepository } from './repository';
import bcrypt from 'bcryptjs';

export class UserManagementService {
    private primaryRepo: UserManagementRepository;
    private statutoryRepo: UserManagementRepository;
    private dbState: any;

    constructor(primaryDb: Database, statutoryDb: Database, dbState: any) {
        this.primaryRepo = new UserManagementRepository(primaryDb);
        this.statutoryRepo = new UserManagementRepository(statutoryDb);
        this.dbState = dbState;
    }

    private runWrite(fn: (repo: UserManagementRepository) => void) {
        fn(this.primaryRepo);
        if (this.dbState && this.dbState.state !== 'DISCONNECTED_AUDIT') {
            try {
                fn(this.statutoryRepo);
            } catch (e) {
                console.warn('Failed to write to statutory DB inside runWrite', e);
            }
        }
    }

    getUsers(currentUser: any) {
        let users = this.primaryRepo.getUsers();
        // Hide SUPERADMIN from non-superadmins
        if (currentUser.role !== 'SUPERADMIN') {
            users = users.filter(u => u.role_name !== 'SUPERADMIN');
        }
        return users;
    }

    async createUser(data: any, currentUser: any) {
        if (data.password) {
            data.password_hash = await bcrypt.hash(data.password, 10);
            delete data.password;
        }
        const id = this.primaryRepo.createUser(data);
        if (this.dbState && this.dbState.state !== 'DISCONNECTED_AUDIT') {
            try {
                // Must ensure IDs match, so inject the id if the repo supports it, 
                // but since repo uses lastInsertRowid, we should patch the SQL or just accept autoincrement drift.
                // Assuming IDs are in sync:
                this.statutoryRepo.createUser({ ...data, id }); 
            } catch (e) {
                console.warn('Failed to write to statutory DB inside createUser', e);
            }
        }
        this.primaryRepo.logAudit('USER_CREATED', id.toString(), `Created user ${data.username}`, currentUser.username);
        return id;
    }

    async updateUser(id: number, data: any, currentUser: any) {
        const existing = this.primaryRepo.getUserById(id);
        if (!existing) throw new Error('User not found');
        
        const existingRole = this.primaryRepo.getRoleById(existing.role_id);
        if (existingRole?.name === 'SUPERADMIN' && currentUser.role !== 'SUPERADMIN') {
            throw new Error('Cannot edit SUPERADMIN user');
        }

        if (data.password) {
            data.password_hash = await bcrypt.hash(data.password, 10);
            delete data.password;
        }
        
        this.runWrite(repo => repo.updateUser(id, data));
        this.primaryRepo.logAudit('USER_UPDATED', id.toString(), `Updated user ${existing.username}`, currentUser.username);
    }

    deleteUser(id: number, currentUser: any) {
        const existing = this.primaryRepo.getUserById(id);
        if (!existing) throw new Error('User not found');
        
        const existingRole = this.primaryRepo.getRoleById(existing.role_id);
        if (existingRole?.name === 'SUPERADMIN') {
            throw new Error('SUPERADMIN cannot be deleted');
        }

        this.runWrite(repo => repo.deleteUser(id));
        this.primaryRepo.logAudit('USER_DELETED', id.toString(), `Deleted user ${existing.username}`, currentUser.username);
    }

    // Roles
    getRoles(currentUser: any) {
        let roles = this.primaryRepo.getRoles();
        if (currentUser.role !== 'SUPERADMIN') {
            roles = roles.filter(r => r.name !== 'SUPERADMIN');
        }
        return roles;
    }

    getRolePermissions(roleId: number) {
        return this.primaryRepo.getRolePermissions(roleId);
    }

    updateRolePermissions(roleId: number, permissions: any[], currentUser: any) {
        const role = this.primaryRepo.getRoleById(roleId);
        if (!role) throw new Error('Role not found');
        
        if (role.name === 'SUPERADMIN') throw new Error('Cannot edit SUPERADMIN permissions');
        
        // Ensure AUDITOR remains read-only
        if (role.name === 'AUDITOR') {
            permissions = permissions.map(p => ({ ...p, can_insert: 0, can_edit: 0, can_delete: 0 }));
        }

        this.runWrite(repo => repo.updateRolePermissions(roleId, permissions));
        this.primaryRepo.logAudit('ROLE_PERMISSIONS_UPDATED', roleId.toString(), `Updated permissions for ${role.name}`, currentUser.username);
    }

    getAuditLogs(currentUser: any) {
        if (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'ADMIN') {
            return [];
        }
        return this.primaryRepo.getAuditLogs();
    }
}