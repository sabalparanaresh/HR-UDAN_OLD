import express from 'express';
import { ConfigRepository } from './repository.js';

export const configRouter = express.Router();

configRouter.get('/company', (req: any, res) => {
    try {
        const repo = new ConfigRepository(req.primaryDb, req.statutoryDb);
        const moduleType = req.headers['x-module-type'] as string || 'K';
        const data = repo.getCompanyConfig(moduleType);
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

configRouter.post('/company', (req: any, res) => {
    try {
        const repo = new ConfigRepository(req.primaryDb, req.statutoryDb);
        const moduleType = req.headers['x-module-type'] as string || 'K';
        repo.saveCompanyConfig(req.body.config, moduleType);
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

configRouter.get('/payroll-rules', (req: any, res) => {
    try {
        const repo = new ConfigRepository(req.primaryDb, req.statutoryDb);
        const moduleType = req.headers['x-module-type'] as string || 'K';
        const data = repo.getPayrollRules(moduleType);
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

configRouter.post('/payroll-rules', (req: any, res) => {
    try {
        const repo = new ConfigRepository(req.primaryDb, req.statutoryDb);
        const moduleType = req.headers['x-module-type'] as string || 'K';
        repo.updatePayrollRules(req.body.rules, moduleType);
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
