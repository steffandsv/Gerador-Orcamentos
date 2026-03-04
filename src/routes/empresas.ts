import { Router } from 'express';
import { db } from '../db';
import { empresas } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { logAudit } from '../lib/audit';

export const empresasRouter = Router();

// GET /empresas - List Companies (excluding soft-deleted)
empresasRouter.get('/', async (req, res) => {
    try {
        const allEmpresas = await db.select().from(empresas).where(isNull(empresas.deleted_at));
        res.render('company_list', { empresas: allEmpresas });
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error");
    }
});

// GET /empresas/form - Form for creating or editing a company
empresasRouter.get('/form', async (req, res) => {
    try {
        const id = req.query.id as string;
        let empresa: Record<string, any> | null = null;

        if (id) {
            const found = await db.select().from(empresas).where(eq(empresas.id, Number.parseInt(id)));
            if (found.length > 0) empresa = found[0];
        }

        res.render('company_form', { empresa: empresa || {} });
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error");
    }
});

// POST /empresas/save - Save or update company
empresasRouter.post('/save', async (req, res) => {
    try {
        const currentUser = res.locals.currentUser;
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
            const existing = await db.select().from(empresas).where(eq(empresas.id, Number.parseInt(id)));

            await db.update(empresas).set({
                ...payload,
                updated_by: currentUser.id,
                updated_at: new Date(),
            }).where(eq(empresas.id, Number.parseInt(id)));

            await logAudit({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'update',
                entity: 'empresa',
                entityId: Number.parseInt(id),
                details: `Empresa "${payload.nome}" atualizada`,
                oldData: existing.length > 0 ? { nome: existing[0].nome, documento: existing[0].documento, email: existing[0].email } : null,
                newData: { nome: payload.nome, documento: payload.documento, email: payload.email },
                ipAddress: req.ip ?? null,
            });
        } else {
            const [result] = await db.insert(empresas).values({
                ...payload,
                created_by: currentUser.id,
            });

            await logAudit({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'create',
                entity: 'empresa',
                entityId: result.insertId,
                details: `Empresa "${payload.nome}" criada`,
                newData: { nome: payload.nome, documento: payload.documento, email: payload.email },
                ipAddress: req.ip ?? null,
            });
        }

        res.redirect('/empresas');
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error on saving company");
    }
});

// POST /empresas/delete - Soft Delete company
empresasRouter.post('/delete', async (req, res) => {
    try {
        const currentUser = res.locals.currentUser;
        const id = req.body.id;

        if (id) {
            const existing = await db.select().from(empresas).where(eq(empresas.id, Number.parseInt(id)));

            await db.update(empresas).set({
                deleted_at: new Date(),
                deleted_by: currentUser.id,
            }).where(eq(empresas.id, Number.parseInt(id)));

            await logAudit({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'delete',
                entity: 'empresa',
                entityId: Number.parseInt(id),
                details: `Empresa "${existing[0]?.nome}" desativada (soft delete)`,
                oldData: existing.length > 0 ? { nome: existing[0].nome } : null,
                ipAddress: req.ip ?? null,
            });
        }
        res.redirect('/empresas');
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error deleting company");
    }
});
