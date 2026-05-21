import { AuthRepository } from './repository.js';
import { Database } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../../config.js';

export class AuthService {
    private repo: AuthRepository;

    constructor(db: Database) {
        this.repo = new AuthRepository(db);
    }

    async login(username: string, password: string) {
        if (!username || !password) throw new Error('Username and password are required');
        
        const user = this.repo.getUserByUsername(username);
        if (!user) throw new Error('Invalid credentials');

        const valid = user.password.startsWith('$argon') ? false : await bcrypt.compare(password, user.password);
        if (!valid) throw new Error('Invalid credentials');

        const bridgeRow = this.repo.getBridgeState();
        const isDisconnected = bridgeRow?.state === 'DISCONNECTED_AUDIT';
        
        let available_modules = isDisconnected ? ['P'] : ['K', 'P'];
        if (user.is_hidden_superadmin === 1) available_modules = ['K', 'P']; 

        const rolePermissions = this.repo.getRolePermissions(user.role_id);
        const permissionsMap: Record<string, boolean> = {};
        for (const rp of rolePermissions) {
            if (rp.can_view) permissionsMap[`${rp.page_key}.view`] = true;
            if (rp.can_insert) permissionsMap[`${rp.page_key}.insert`] = true;
            if (rp.can_edit) permissionsMap[`${rp.page_key}.edit`] = true;
            if (rp.can_delete) permissionsMap[`${rp.page_key}.delete`] = true;
            if (rp.can_view) permissionsMap[rp.page_key] = true;
        }

        const token = jwt.sign(
            { 
              id: user.id, 
              username: user.username,
              role: user.role_name 
            }, 
            CONFIG.SECURITY_KEY,
            { expiresIn: '24h' }
        );

        return {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role_name,
            is_hidden_superadmin: user.is_hidden_superadmin === 1,
            rbac_cache: {
              permissions: permissionsMap,
              module_scope: user.module_scope || 'NONE'
            },
            available_modules,
            connection_status: isDisconnected ? 'DISCONNECTED' : 'CONNECTED',
            token
        };
    }

    verifyIdentity(mobile: string, birthDate: string, answer1: string, answer2: string) {
        const user = this.repo.getUserByVerificationInfo(mobile, birthDate, answer1, answer2);
        if (!user) throw new Error('Information does not match our records');
        
        const token = `TKN-${Date.now()}`;
        const expires = new Date(Date.now() + 15 * 60000).toISOString();
        this.repo.createPasswordResetToken(user.id, token, expires);
        return { token };
    }

    async resetPassword(token: string, newPassword: string) {
        const record = this.repo.getTokenRecord(token);
        if (!record) throw new Error('Invalid or used token');
        if (new Date() > new Date(record.expires_at)) throw new Error('Token expired');
        
        const hash = await bcrypt.hash(newPassword, 10);
        this.repo.updatePassword(record.user_id, hash);
        this.repo.markTokenUsed(token);
        return { status: 'success' };
    }
}
