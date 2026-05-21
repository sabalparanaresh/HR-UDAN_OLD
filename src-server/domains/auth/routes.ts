import express from 'express';
import { AuthService } from './service.js';

export const authRouter = express.Router();

authRouter.post('/login', async (req: any, res) => {
    try {
        const service = new AuthService(req.primaryDb);
        const username = req.body.username || req.body.loginUsername;
        const password = req.body.password || req.body.loginPassword;
        const data = await service.login(username, password);
        res.json(data);
    } catch (e: any) {
        res.status(401).json({ error: e.message });
    }
});

authRouter.post('/verify-identity', (req: any, res) => {
    try {
        const service = new AuthService(req.primaryDb);
        const { mobile, birth_date, answer_1, answer_2 } = req.body;
        const data = service.verifyIdentity(mobile, birth_date, answer_1, answer_2);
        res.json(data);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

authRouter.post('/reset-password', async (req: any, res) => {
    try {
        const service = new AuthService(req.primaryDb);
        const { token, new_password } = req.body;
        const data = await service.resetPassword(token, new_password);
        res.json(data);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
