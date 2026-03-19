import { Router, Request, Response } from 'express';
import { db } from '../db';
import { orcamentos, itens_orcamento } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { logAudit } from '../lib/audit';

export const orcamentosApiRouter = Router();

// ── POST /api/orcamentos/save-draft — Save entire quote via AJAX (no redirect) ──
orcamentosApiRouter.post('/orcamentos/save-draft', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const payload = {
            titulo: req.body.titulo,
            empresa1_id: req.body.empresa1_id ? Number.parseInt(req.body.empresa1_id) : null,
            empresa2_id: req.body.empresa2_id ? Number.parseInt(req.body.empresa2_id) : null,
            empresa3_id: req.body.empresa3_id ? Number.parseInt(req.body.empresa3_id) : null,
            template1_id: Number.parseInt(req.body.template1_id) || 1,
            template2_id: Number.parseInt(req.body.template2_id) || 2,
            template3_id: Number.parseInt(req.body.template3_id) || 3,
            variacao_maxima: req.body.variacao_maxima || '10',
            solicitante_nome: req.body.solicitante_nome || null,
            solicitante_cnpj: req.body.solicitante_cnpj || null,
        };

        const items = req.body.items || [];
        const quote_id = req.body.quote_id;

        let orcamento_id: number;

        await db.transaction(async (tx) => {
            if (quote_id) {
                orcamento_id = Number.parseInt(quote_id);

                await tx.update(orcamentos).set({
                    ...payload,
                    updated_by: currentUser.id,
                    updated_at: new Date(),
                } as any).where(eq(orcamentos.id, orcamento_id));

                // Delete old items and re-insert
                await tx.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, orcamento_id));
            } else {
                const [maxPos] = await tx.select({ maxP: sql`COALESCE(MAX(position), 0)` })
                    .from(orcamentos)
                    .where(eq(orcamentos.stage, 'inbox'));
                const nextPosition = (maxPos?.maxP as number || 0) + 1;

                const [result] = await tx.insert(orcamentos).values({
                    ...payload,
                    stage: 'inbox',
                    position: nextPosition,
                    created_by: currentUser.id,
                } as any);
                orcamento_id = result.insertId;
            }

            // Insert items (accept partial items)
            if (items.length > 0) {
                const itemsToInsert = items
                    .filter((item: any) => item.descricao || item.valor_compra || item.valor_venda)
                    .map((item: any) => ({
                        orcamento_id,
                        codigo: item.codigo ? Number.parseInt(item.codigo) : null,
                        descricao: item.descricao || '',
                        quantidade: item.quantidade || '1',
                        valor_compra: item.valor_compra || '0',
                        valor_venda: item.valor_venda || null,
                        auto_preco: item.auto_preco === '1' ? 1 : 0,
                        marca_modelo: item.marca_modelo || null,
                        link_compra: item.link_compra || null,
                    }));

                if (itemsToInsert.length > 0) {
                    await tx.insert(itens_orcamento).values(itemsToInsert);
                }
            }

            // Re-fetch inserted items so we can return IDs
            const savedItems = await tx.select().from(itens_orcamento)
                .where(eq(itens_orcamento.orcamento_id, orcamento_id));

            res.json({
                success: true,
                orcamento_id,
                items: savedItems.map(i => ({
                    id: i.id,
                    codigo: i.codigo,
                    descricao: i.descricao,
                    quantidade: i.quantidade,
                    valor_compra: i.valor_compra,
                    valor_venda: i.valor_venda,
                    auto_preco: i.auto_preco,
                    marca_modelo: i.marca_modelo,
                    link_compra: i.link_compra,
                })),
            });
        });
    } catch (e: any) {
        console.error('save-draft error:', e);
        res.status(500).json({ success: false, message: 'Erro ao salvar rascunho: ' + e.message });
    }
});

// ── PATCH /api/orcamentos/:id/header — Update only header fields ──
orcamentosApiRouter.patch('/orcamentos/:id/header', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const id = Number(req.params.id);
        const { titulo, solicitante_nome, solicitante_cnpj, empresa1_id, empresa2_id, empresa3_id, variacao_maxima, template1_id, template2_id, template3_id } = req.body;

        const updateData: any = {
            updated_by: currentUser.id,
            updated_at: new Date(),
        };

        if (titulo !== undefined) updateData.titulo = titulo;
        if (solicitante_nome !== undefined) updateData.solicitante_nome = solicitante_nome || null;
        if (solicitante_cnpj !== undefined) updateData.solicitante_cnpj = solicitante_cnpj || null;
        if (empresa1_id !== undefined) updateData.empresa1_id = empresa1_id ? Number(empresa1_id) : null;
        if (empresa2_id !== undefined) updateData.empresa2_id = empresa2_id ? Number(empresa2_id) : null;
        if (empresa3_id !== undefined) updateData.empresa3_id = empresa3_id ? Number(empresa3_id) : null;
        if (variacao_maxima !== undefined) updateData.variacao_maxima = variacao_maxima;
        if (template1_id !== undefined) updateData.template1_id = Number(template1_id);
        if (template2_id !== undefined) updateData.template2_id = Number(template2_id);
        if (template3_id !== undefined) updateData.template3_id = Number(template3_id);

        await db.update(orcamentos).set(updateData).where(eq(orcamentos.id, id));

        res.json({ success: true });
    } catch (e: any) {
        console.error('patch header error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── PATCH /api/orcamentos/:id/items/:itemId — Update a single item field ──
orcamentosApiRouter.patch('/orcamentos/:id/items/:itemId', async (req: Request, res: Response) => {
    try {
        const itemId = Number(req.params.itemId);
        const fields = req.body;

        const updateData: any = {};
        if (fields.codigo !== undefined) updateData.codigo = fields.codigo ? Number(fields.codigo) : null;
        if (fields.descricao !== undefined) updateData.descricao = fields.descricao;
        if (fields.quantidade !== undefined) updateData.quantidade = fields.quantidade;
        if (fields.valor_compra !== undefined) updateData.valor_compra = fields.valor_compra;
        if (fields.valor_venda !== undefined) updateData.valor_venda = fields.valor_venda || null;
        if (fields.auto_preco !== undefined) updateData.auto_preco = fields.auto_preco === '1' || fields.auto_preco === 1 ? 1 : 0;
        if (fields.marca_modelo !== undefined) updateData.marca_modelo = fields.marca_modelo || null;
        if (fields.link_compra !== undefined) updateData.link_compra = fields.link_compra || null;

        if (Object.keys(updateData).length > 0) {
            await db.update(itens_orcamento).set(updateData).where(eq(itens_orcamento.id, itemId));
        }

        res.json({ success: true });
    } catch (e: any) {
        console.error('patch item error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /api/orcamentos/:id/items — Create a new item and return its ID ──
orcamentosApiRouter.post('/orcamentos/:id/items', async (req: Request, res: Response) => {
    try {
        const orcamentoId = Number(req.params.id);
        const item = req.body;

        const [result] = await db.insert(itens_orcamento).values({
            orcamento_id: orcamentoId,
            codigo: item.codigo ? Number(item.codigo) : null,
            descricao: item.descricao || '',
            quantidade: item.quantidade || '1',
            valor_compra: item.valor_compra || '0',
            valor_venda: item.valor_venda || null,
            auto_preco: item.auto_preco === '1' ? 1 : 0,
            marca_modelo: item.marca_modelo || null,
            link_compra: item.link_compra || null,
        });

        res.json({ success: true, item_id: result.insertId });
    } catch (e: any) {
        console.error('create item error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /api/orcamentos/:id/items/:itemId — Remove an item ──
orcamentosApiRouter.delete('/orcamentos/:id/items/:itemId', async (req: Request, res: Response) => {
    try {
        const itemId = Number(req.params.itemId);
        await db.delete(itens_orcamento).where(eq(itens_orcamento.id, itemId));
        res.json({ success: true });
    } catch (e: any) {
        console.error('delete item error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});
