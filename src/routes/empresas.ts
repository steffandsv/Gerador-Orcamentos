import { Router } from 'express';
import { db } from '../db';
import { empresas } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { logAudit } from '../lib/audit';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

export const empresasRouter = Router();

// ── Multer config for company documentation upload ──
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'docs');

const docStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `empresa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, uniqueName);
    },
});

const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.zip', '.rar'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não permitido: ${ext}. Aceitos: .pdf, .zip, .rar`));
        }
    },
});

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

// POST /empresas/save - Save or update company (with optional file upload)
empresasRouter.post('/save', docUpload.single('documentacao'), async (req, res) => {
    try {
        const currentUser = res.locals.currentUser;
        const payload: Record<string, any> = {
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

        // Handle file upload
        if (req.file) {
            payload.doc_path = path.relative(path.join(__dirname, '..', '..'), req.file.path);
            payload.doc_original_name = req.file.originalname;
        }

        // Handle document removal request
        if (req.body.remove_doc === '1' && !req.file) {
            payload.doc_path = null;
            payload.doc_original_name = null;
        }

        const id = req.body.id;

        if (id) {
            const existing = await db.select().from(empresas).where(eq(empresas.id, Number.parseInt(id)));

            // Delete old doc file if uploading new one or removing
            if ((req.file || req.body.remove_doc === '1') && existing[0]?.doc_path) {
                const oldPath = path.join(__dirname, '..', '..', existing[0].doc_path);
                try { fs.unlinkSync(oldPath); } catch { /* file may not exist */ }
            }

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
                details: `Empresa "${payload.nome}" atualizada${req.file ? ' (doc atualizada)' : ''}`,
                oldData: existing.length > 0 ? { nome: existing[0].nome, documento: existing[0].documento, email: existing[0].email } : null,
                newData: { nome: payload.nome, documento: payload.documento, email: payload.email },
                ipAddress: req.ip ?? null,
            });
        } else {
            const [result] = await db.insert(empresas).values({
                ...payload,
                created_by: currentUser.id,
            } as any);

            await logAudit({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'create',
                entity: 'empresa',
                entityId: result.insertId,
                details: `Empresa "${payload.nome}" criada${req.file ? ' (com documentação)' : ''}`,
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
