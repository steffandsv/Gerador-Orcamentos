import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, like, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';

export const apiRouter = Router();

// GET /api/search_solicitante
apiRouter.get('/search_solicitante', async (req, res) => {
    try {
        const term = req.query.term as string || '';
        if (term.length < 2) {
            return res.json([]);
        }

        const results = await db.selectDistinct({
            solicitante_nome: orcamentos.solicitante_nome,
            solicitante_cnpj: orcamentos.solicitante_cnpj
        })
        .from(orcamentos)
        .where(like(orcamentos.solicitante_nome, `%${term}%`))
        .limit(10);

        res.json(results);
    } catch (e) {
        res.status(500).json([]);
    }
});

// POST /api/test_smtp
// Expected payload matches legacy PHP `api/test_smtp.php`
apiRouter.post('/test_smtp', async (req, res) => {
    try {
        const { host, port, user, pass, secure } = req.body;
        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure === 'ssl' || secure === 'true', 
            auth: {
                user,
                pass
            }
        });

        await transporter.verify();
        res.json({ success: true, message: 'Conexão SMTP bem-sucedida! Pronto para enviar e-mails.' });
    } catch (e: any) {
        res.json({ success: false, message: 'Erro de conexão: ' + e.message });
    }
});

// POST /api/send_budget - To be fully implemented when views are ready (Requires Puppeteer to mimic PHP logic usually, or just an endpoint response)
apiRouter.post('/send_budget', async (req, res) => {
    res.json({ success: false, message: 'API send_budget under Node.JS migration' });
});
