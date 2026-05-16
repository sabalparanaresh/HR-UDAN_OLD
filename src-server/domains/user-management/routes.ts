import { Router } from 'express';
import { UserManagementService } from './service';

export const usermanagementRouter = Router();

usermanagementRouter.get('/', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        const users = service.getUsers(req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true, data: users });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.post('/', async (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        const id = await service.createUser(req.body, req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true, id });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.put('/:id', async (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        await service.updateUser(Number(req.params.id), req.body, req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.delete('/:id', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        service.deleteUser(Number(req.params.id), req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.get('/roles', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        const roles = service.getRoles(req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true, data: roles });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.get('/roles/:id/permissions', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        const perms = service.getRolePermissions(Number(req.params.id));
        res.json({ success: true, data: perms });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.put('/roles/:id/permissions', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        service.updateRolePermissions(Number(req.params.id), req.body.permissions, req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

usermanagementRouter.get('/audit', (req: any, res) => {
    try {
        const service = new UserManagementService(req.primaryDb);
        const logs = service.getAuditLogs(req.user || { role: 'SUPERADMIN', username: 'system' });
        res.json({ success: true, data: logs });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

