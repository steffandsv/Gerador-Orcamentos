import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { logAudit } from '../lib/audit';

export const orcamentosRouter = Router();

// GET /orcamentos - List Quotes (excluding soft-deleted)
orcamentosRouter.get('/', async (req, res) => {
    try {
        const results = await db.select({
            id: orcamentos.id,
            titulo: orcamentos.titulo,
            data_criacao: orcamentos.data_criacao,
            empresa1_id: orcamentos.empresa1_id,
            empresa2_id: orcamentos.empresa2_id,
            empresa3_id: orcamentos.empresa3_id,
            variacao_maxima: orcamentos.variacao_maxima,
            solicitante_nome: orcamentos.solicitante_nome,
            solicitante_cnpj: orcamentos.solicitante_cnpj,
            empresa_vencedora: empresas.nome
        })
        .from(orcamentos)
        .leftJoin(empresas, eq(orcamentos.empresa1_id, empresas.id))
        .where(isNull(orcamentos.deleted_at))
        .orderBy(desc(orcamentos.data_criacao));
        
        res.render('quote_list', { orcamentos: results });
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error listing quotes");
    }
});

// GET /orcamentos/form - Form for creating or editing a quote
orcamentosRouter.get('/form', async (req, res) => {
    try {
        const id = req.query.id as string;
        const allEmpresas = await db.select().from(empresas).where(isNull(empresas.deleted_at));

        let quote_edit = null;
        let items_edit: any[] = [];

        if (id) {
            const found = await db.select().from(orcamentos).where(eq(orcamentos.id, Number.parseInt(id)));
            if (found.length > 0) {
                quote_edit = found[0];
                items_edit = await db.select().from(itens_orcamento).where(eq(itens_orcamento.orcamento_id, Number.parseInt(id)));
            }
        }

        res.render('quote_form', {
            empresas: allEmpresas,
            quote_edit,
            items_edit
        });
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error loading quote form");
    }
});

// POST /orcamentos/delete (soft delete)
orcamentosRouter.post('/delete', async (req, res) => {
    try {
        const currentUser = res.locals.currentUser;
        const id = req.body.id;

        if (id) {
            const existing = await db.select().from(orcamentos).where(eq(orcamentos.id, Number.parseInt(id)));

            await db.update(orcamentos).set({
                deleted_at: new Date(),
                deleted_by: currentUser.id,
            }).where(eq(orcamentos.id, Number.parseInt(id)));

            await logAudit({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'delete',
                entity: 'orcamento',
                entityId: Number.parseInt(id),
                details: `Orçamento "${existing[0]?.titulo}" desativado (soft delete)`,
                oldData: existing.length > 0 ? { titulo: existing[0].titulo } : null,
                ipAddress: req.ip ?? null,
            });
        }
        res.redirect('/orcamentos');
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error deleting quote");
    }
});

// POST /orcamentos/save
orcamentosRouter.post('/save', async (req, res) => {
    try {
        const currentUser = res.locals.currentUser;
        const payload = {
            titulo: req.body.titulo,
            empresa1_id: Number.parseInt(req.body.empresa1_id),
            empresa2_id: Number.parseInt(req.body.empresa2_id),
            empresa3_id: Number.parseInt(req.body.empresa3_id),
            template1_id: Number.parseInt(req.body.template1_id) || 1,
            template2_id: Number.parseInt(req.body.template2_id) || 2,
            template3_id: Number.parseInt(req.body.template3_id) || 3,
            variacao_maxima: req.body.variacao_maxima,
            solicitante_nome: req.body.solicitante_nome || null,
            solicitante_cnpj: req.body.solicitante_cnpj || null
        };

        const items = req.body.items || [];
        const quote_id = req.body.quote_id;

        await db.transaction(async (tx) => {
            let orcamento_id: number;

            if (quote_id) {
                orcamento_id = Number.parseInt(quote_id);
                const existing = await tx.select().from(orcamentos).where(eq(orcamentos.id, orcamento_id));

                await tx.update(orcamentos).set({
                    ...payload,
                    updated_by: currentUser.id,
                    updated_at: new Date(),
                }).where(eq(orcamentos.id, orcamento_id));

                await tx.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, orcamento_id));

                await logAudit({
                    userId: currentUser.id,
                    username: currentUser.username,
                    action: 'update',
                    entity: 'orcamento',
                    entityId: orcamento_id,
                    details: `Orçamento "${payload.titulo}" atualizado`,
                    oldData: existing.length > 0 ? { titulo: existing[0].titulo, variacao_maxima: existing[0].variacao_maxima } : null,
                    newData: { titulo: payload.titulo, variacao_maxima: payload.variacao_maxima },
                    ipAddress: req.ip ?? null,
                });
            } else {
                const [result] = await tx.insert(orcamentos).values({
                    ...payload,
                    created_by: currentUser.id,
                });
                orcamento_id = result.insertId;

                await logAudit({
                    userId: currentUser.id,
                    username: currentUser.username,
                    action: 'create',
                    entity: 'orcamento',
                    entityId: orcamento_id,
                    details: `Orçamento "${payload.titulo}" criado`,
                    newData: { titulo: payload.titulo, variacao_maxima: payload.variacao_maxima },
                    ipAddress: req.ip ?? null,
                });
            }

            if (items.length > 0) {
                const itemsToInsert = items
                    .filter((item: any) => item.descricao)
                    .map((item: any) => ({
                        orcamento_id,
                        codigo: item.codigo ? Number.parseInt(item.codigo) : null,
                        descricao: item.descricao,
                        quantidade: item.quantidade,
                        valor_compra: item.valor_compra,
                        valor_venda: item.valor_venda || null,
                        auto_preco: item.auto_preco === '1' ? 1 : 0,
                        marca_modelo: item.marca_modelo || null,
                        link_compra: item.link_compra || null
                    }));
                
                if (itemsToInsert.length > 0) {
                    await tx.insert(itens_orcamento).values(itemsToInsert);
                }
            }
        });

        res.redirect('/orcamentos');
    } catch (e) {
        console.error(e);
        res.status(500).send("Error saving quote");
    }
});
