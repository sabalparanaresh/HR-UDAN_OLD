import { Database } from 'better-sqlite3';
import { UserManagementRepository } from './repository';
import bcrypt from 'bcrypt';

export class UserManagementService {
    private repo: UserManagementRepository;

    constructor(db: Database) {
        this.repo = new UserManagementRepository(db);
    }

    getUsers(currentUser: any) {
        let users = this.repo.getUsers();
        // Hide SUPERADMIN from non-superadmins
        if (currentUser.role !== 'SUPERADMIN') {
            users = users.filter(u => u.role_name !== 'SUPERADMIN');
        }
        return users;
    }

    async createUser(data: any, currentUser: any) {
        if (data.password) {
            data.password_hash = await bcrypt.hash(data.password, 10);
            data.password = data.password_hash; // legacy
        }
        const id = this.repo.createUser(data);
        this.repo.logAudit('USER_CREATED', id.toString(), `Created user ${data.username}`, currentUser.username);
        return id;
    }

    async updateUser(id: number, data: any, currentUser: any) {
        const existing = this.repo.getUserById(id);
        if (!existing) throw new Error('User not found');
        
        const existingRole = this.repo.getRoleById(existing.role_id);
        if (existingRole?.name === 'SUPERADMIN' && currentUser.role !== 'SUPERADMIN') {
            throw new Error('Cannot edit SUPERADMIN user');
        }

        if (data.password) {
            data.password_hash = await bcrypt.hash(data.password, 10);
            data.password = data.password_hash; // legacy
        }
        
        this.repo.updateUser(id, data);
        this.repo.logAudit('USER_UPDATED', id.toString(), `Updated user ${existing.username}`, currentUser.username);
    }

    deleteUser(id: number, currentUser: any) {
        const existing = this.repo.getUserById(id);
        if (!existing) throw new Error('User not found');
        
        const existingRole = this.repo.getRoleById(existing.role_id);
        if (existingRole?.name === 'SUPERADMIN') {
            throw new Error('SUPERADMIN cannot be deleted');
        }

        this.repo.deleteUser(id);
        this.repo.logAudit('USER_DELETED', id.toString(), `Deleted user ${existing.username}`, currentUser.username);
    }

    // Roles
    getRoles(currentUser: any) {
        let roles = this.repo.getRoles();
        if (currentUser.role !== 'SUPERADMIN') {
            roles = roles.filter(r => r.name !== 'SUPERADMIN');
        }
        return roles;
    }

    getRolePermissions(roleId: number) {
        return this.repo.getRolePermissions(roleId);
    }

    updateRolePermissions(roleId: number, permissions: any[], currentUser: any) {
        const role = this.repo.getRoleById(roleId);
        if (!role) throw new Error('Role not found');
        
        if (role.name === 'SUPERADMIN') throw new Error('Cannot edit SUPERADMIN permissions');
        
        // Ensure AUDITOR remains read-only
        if (role.name === 'AUDITOR') {
            permissions = permissions.map(p => ({ ...p, can_insert: 0, can_edit: 0, can_delete: 0 }));
        }

        this.repo.updateRolePermissions(roleId, permissions);
        this.repo.logAudit('ROLE_PERMISSIONS_UPDATED', roleId.toString(), `Updated permissions for ${role.name}`, currentUser.username);
    }

    getAuditLogs(currentUser: any) {
        if (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'ADMIN') {
            return []; // or throw? maybe return empty or limited
        }
        return this.repo.getAuditLogs();
    }
}