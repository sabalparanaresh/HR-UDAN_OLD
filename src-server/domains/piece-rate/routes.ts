import { Router, Request, Response } from 'express';
import { PieceRateService } from './service';

export const pieceRateRouter = Router();

pieceRateRouter.get('/heads', (req: Request, res: Response) => {
    try {
        const db = (req as any).primaryDb;
        const service = new PieceRateService(db);
        const page = parseInt((req.query.page as string) || '1');
        const limit = parseInt((req.query.limit as string) || '20');
        const search = (req.query.search as string) || '';
        
        const result = service.getHeads(page, limit, search);
        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error('[Piece Rate] get heads error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

pieceRateRouter.post('/heads/upload', (req: Request, res: Response) => {
    try {
        const db = (req as any).primaryDb;
        const service = new PieceRateService(db);
        const user = req.headers['x-user-id'] as string || 'system';
        
        let upserted = 0;
        // Expect an array of configs
        const configs = req.body.data;
        if (!Array.isArray(configs)) {
            return res.status(400).json({ success: false, error: 'Data must be an array' });
        }

        // We can reuse saveHeadWithDetails in a transaction, but since it already starts its own transaction,
        // we might run into issues if we loop. Better to loop over them. 
        // A proper way is to use saveHeadWithDetails
        for (const config of configs) {
            // Find existing by name to upsert
            const existing = db.prepare('SELECT id FROM piece_rate_heads WHERE name = ?').get(config.name) as {id: string};
            if (existing) {
                config.id = existing.id;
            }
            service.saveHeadWithDetails(config, user);
            upserted++;
        }

        res.json({ success: true, message: `Successfully upserted ${upserted} configurations.` });
    } catch (error: any) {
        console.error('[Piece Rate] bulk upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

pieceRateRouter.post('/heads', (req: Request, res: Response) => {
    try {
        const db = (req as any).primaryDb;
        const service = new PieceRateService(db);
        const user = req.headers['x-user-id'] as string || 'system';
        const result = service.saveHeadWithDetails(req.body, user);
        res.json({ success: true, data: { id: result } });
    } catch (error: any) {
        console.error('[Piece Rate] save head error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

pieceRateRouter.delete('/heads/:id', (req: Request, res: Response) => {
    try {
        const db = (req as any).primaryDb;
        const service = new PieceRateService(db);
        service.deleteHead(req.params.id as string, 'admin');
        res.json({ success: true });
    } catch (error: any) {
        console.error('[Piece Rate] delete head error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
