import express from 'express';
import { ProductionEntryService } from './service';

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const { page = 1, limit = 50, search = '' } = req.query;
        const result = service.getList(Number(page), Number(limit), search as string);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:id', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const result = service.getById(req.params.id);
        if (!result) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const user = 'SYSTEM'; // or from req.user
        const id = service.create(req.body, user);
        res.json({ success: true, id });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const user = 'SYSTEM';
        service.update(req.params.id, req.body, user);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id/status', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const user = 'SYSTEM';
        service.updateStatus(req.params.id, req.body.status, user);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        service.delete(req.params.id, 'admin');
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/config/details', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const emp_id = Number(req.query.emp_id);
        if (!emp_id) return res.status(400).json({ success: false, error: 'emp_id is required' });
        
        const data = service.getHeadsForEmployee(emp_id);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/calculate-rate', (req, res) => {
    try {
        const db = (req as any).primaryDb;
        const service = new ProductionEntryService(db);
        const { head_id, quantity, date } = req.body;
        if (!head_id || quantity === undefined || !date) {
            return res.status(400).json({ success: false, error: 'head_id, quantity, and date are required' });
        }
        
        const data = service.calculateRate(head_id, Number(quantity), date);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export const productionEntryRouter = router;
