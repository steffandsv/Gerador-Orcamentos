import { Router } from 'express';
import { db } from '../db';
import { empresas } from '../db/schema';
import { eq } from 'drizzle-orm';

export const empresasRouter = Router();

// GET /empresas - List Companies
empresasRouter.get('/', async (req, res) => {
    try {
        const allEmpresas = await db.select().from(empresas);
        res.render('company_list', { empresas: allEmpresas }); // Converted to EJS
    } catch (e) {
        res.status(500).send("Database error");
    }
});

// GET /empresa_form - Form for creating or editing a company
empresasRouter.get('/form', async (req, res) => {
    try {
        const id = req.query.id as string;
        let empresa = null;

        if (id) {
            const found = await db.select().from(empresas).where(eq(empresas.id, parseInt(id)));
            if (found.length > 0) empresa = found[0];
        }

        res.render('company_form', { empresa }); // Converted to EJS
    } catch (e) {
        res.status(500).send("Database error");
    }
});

// POST /empresas/save - Save or update company
empresasRouter.post('/save', async (req, res) => {
    try {
        const payload = {
            nome: req.body.nome,
            documento: req.body.documento || null,
            endereco: req.body.endereco || null,
            telefone: req.body.telefone || null,
            email: req.body.email || null,
            detalhes_adicionais: req.body.detalhes_adicionais || null,
            smtp_host: req.body.smtp_host || null,
            smtp_port: req.body.smtp_port || null,
            smtp_user: req.body.smtp_user || null,
            smtp_pass: req.body.smtp_pass || null,
            smtp_secure: req.body.smtp_secure || null,
        };

        const id = req.body.id;

        if (id) {
            await db.update(empresas).set(payload).where(eq(empresas.id, parseInt(id)));
        } else {
            await db.insert(empresas).values(payload);
        }

        res.redirect('/?page=empresas');
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error on saving company");
    }
});

// POST /empresas/delete - Delete company
empresasRouter.post('/delete', async (req, res) => {
    try {
        const id = req.body.id;
        if (id) {
            await db.delete(empresas).where(eq(empresas.id, parseInt(id)));
        }
        res.redirect('/?page=empresas');
    } catch (e) {
        res.status(500).send("Database error deleting company");
    }
});
