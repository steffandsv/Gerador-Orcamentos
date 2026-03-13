import { Router, Request, Response } from 'express';
import { db } from '../db';
import { orcamentos, labels, orcamento_labels, comments, usuarios, itens_orcamento, card_activities, email_queue, empresas } from '../db/schema';
import { eq, asc, desc, isNull, sql, and, inArray, lte } from 'drizzle-orm';
import { logAudit } from '../lib/audit';
import nodemailer from 'nodemailer';
import multer from 'multer';

export const pipelineRouter = Router();

// ── SSE Clients ──
const sseClients = new Set<Response>();

function broadcastSSE(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        client.write(payload);
    }
}

// ── Constants ──
const STAGES = ['inbox', 'cotacao', 'revisao', 'enviados'] as const;
type Stage = typeof STAGES[number];

const STAGE_META: Record<Stage, { label: string; icon: string }> = {
    inbox: { label: 'Inbox', icon: '📩' },
    cotacao: { label: 'Em Cotação', icon: '⚡' },
    revisao: { label: 'Revisão', icon: '🔍' },
    enviados: { label: 'Enviados', icon: '✅' },
};

// ── GET /pipeline — Render Pipeline Board ──
pipelineRouter.get('/pipeline', async (req: Request, res: Response) => {
    const allUsers = await db.select({
        id: usuarios.id,
        username: usuarios.username,
        nome_completo: usuarios.nome_completo,
    }).from(usuarios).where(isNull(usuarios.deleted_at));

    res.render('pipeline', {
        stages: STAGE_META,
        stageKeys: STAGES,
        users: allUsers,
    });
});

// ── GET /api/pipeline/cards — All cards with labels & assignee ──
pipelineRouter.get('/api/pipeline/cards', async (req: Request, res: Response) => {
    try {
        // Get all non-deleted orcamentos
        const cards = await db.select({
            id: orcamentos.id,
            titulo: orcamentos.titulo,
            stage: orcamentos.stage,
            deadline: orcamentos.deadline,
            assigned_to: orcamentos.assigned_to,
            outcome: orcamentos.outcome,
            description: orcamentos.description,
            position: orcamentos.position,
            data_criacao: orcamentos.data_criacao,
            created_at: orcamentos.created_at,
            solicitante_nome: orcamentos.solicitante_nome,
            delivery_type: orcamentos.delivery_type,
            delivery_target: orcamentos.delivery_target,
            links: orcamentos.links,
        })
        .from(orcamentos)
        .where(and(
            isNull(orcamentos.deleted_at),
            sql`stage != 'enviados'`,
        ))
        .orderBy(asc(orcamentos.position));

        // Get all labels for these cards
        const cardIds = cards.map(c => c.id);
        let cardLabels: any[] = [];
        if (cardIds.length > 0) {
            cardLabels = await db.select({
                orcamento_id: orcamento_labels.orcamento_id,
                label_id: labels.id,
                label_name: labels.name,
                label_color: labels.color,
            })
            .from(orcamento_labels)
            .innerJoin(labels, eq(orcamento_labels.label_id, labels.id))
            .where(inArray(orcamento_labels.orcamento_id, cardIds));
        }

        // Get all users for assignee display
        const allUsers = await db.select({
            id: usuarios.id,
            username: usuarios.username,
            nome_completo: usuarios.nome_completo,
        }).from(usuarios).where(isNull(usuarios.deleted_at));

        const usersMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

        // Get item count per card
        let itemCounts: any[] = [];
        if (cardIds.length > 0) {
            itemCounts = await db.select({
                orcamento_id: itens_orcamento.orcamento_id,
                count: sql<number>`COUNT(*)`,
            })
            .from(itens_orcamento)
            .where(inArray(itens_orcamento.orcamento_id, cardIds))
            .groupBy(itens_orcamento.orcamento_id);
        }
        const itemCountMap = Object.fromEntries(itemCounts.map((ic: any) => [ic.orcamento_id, Number(ic.count)]));

        // Get comment count per card
        let commentCounts: any[] = [];
        if (cardIds.length > 0) {
            commentCounts = await db.select({
                orcamento_id: comments.orcamento_id,
                count: sql<number>`COUNT(*)`,
            })
            .from(comments)
            .where(and(inArray(comments.orcamento_id, cardIds), isNull(comments.deleted_at)))
            .groupBy(comments.orcamento_id);
        }
        const commentCountMap = Object.fromEntries(commentCounts.map((cc: any) => [cc.orcamento_id, Number(cc.count)]));

        // Assemble response
        const labelsMap: Record<number, any[]> = {};
        for (const cl of cardLabels) {
            if (!labelsMap[cl.orcamento_id]) labelsMap[cl.orcamento_id] = [];
            labelsMap[cl.orcamento_id].push({
                id: cl.label_id,
                name: cl.label_name,
                color: cl.label_color,
            });
        }

        const enrichedCards = cards.map(c => ({
            ...c,
            labels: labelsMap[c.id] || [],
            assignee: c.assigned_to ? usersMap[c.assigned_to] || null : null,
            item_count: itemCountMap[c.id] || 0,
            comment_count: commentCountMap[c.id] || 0,
        }));

        res.json({ cards: enrichedCards });
    } catch (e) {
        console.error('Pipeline cards error:', e);
        res.status(500).json({ error: 'Failed to load cards' });
    }
});

// ── POST /api/pipeline/cards — Create a new card from the New Cotação modal ──
pipelineRouter.post('/api/pipeline/cards', async (req: Request, res: Response) => {
    try {
        const { titulo, solicitante_nome, solicitante_cnpj, description, assigned_to, deadline, label_ids, delivery_type, delivery_target, links, imported_items } = req.body;
        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        // Get max position in inbox
        const [maxPos] = await db.select({ max: sql<number>`COALESCE(MAX(position), -1)` })
            .from(orcamentos)
            .where(and(eq(orcamentos.stage, 'inbox'), isNull(orcamentos.deleted_at)));

        const result = await db.insert(orcamentos).values({
            titulo: titulo.trim(),
            solicitante_nome: solicitante_nome?.trim() || null,
            solicitante_cnpj: solicitante_cnpj?.trim() || null,
            description: description?.trim() || null,
            assigned_to: assigned_to ? Number(assigned_to) : null,
            deadline: deadline ? new Date(deadline) : null,
            delivery_type: delivery_type || null,
            delivery_target: delivery_target?.trim() || null,
            links: links || null,
            stage: 'inbox',
            position: Number(maxPos.max) + 1,
        } as any);

        const newId = (result as any)[0]?.insertId;

        // Attach labels
        if (Array.isArray(label_ids) && label_ids.length > 0) {
            for (const labelId of label_ids) {
                await db.insert(orcamento_labels).values({
                    orcamento_id: newId,
                    label_id: Number(labelId),
                } as any);
            }
        }

        // Insert imported items
        if (Array.isArray(imported_items) && imported_items.length > 0) {
            for (const item of imported_items) {
                await db.insert(itens_orcamento).values({
                    orcamento_id: newId,
                    codigo: item.codigo ? Number(item.codigo) || null : null,
                    descricao: item.descricao || 'Item sem descrição',
                    quantidade: Number(item.quantidade) || 1,
                    valor_compra: 0,
                    valor_venda: Number(item.valor_venda) || 0,
                } as any);
            }
        }

        // Audit
        const user = (req as any).session?.user;
        if (user) {
            await logAudit({
                userId: user.id,
                username: user.username,
                action: 'pipeline_card_created' as any,
                entity: 'orcamentos',
                entityId: newId,
                details: titulo.trim(),
            });
        }

        broadcastSSE('card_updated', { cardId: newId });

        // Log activity for Activity tab
        await logActivity({
            orcamentoId: newId,
            userId: user?.id,
            type: 'created',
            metadata: { titulo: titulo.trim() },
        });

        res.json({ success: true, id: newId });
    } catch (e: any) {
        console.error('Create card error:', e);
        res.status(500).json({ error: 'Failed to create card', details: e?.message, stack: e?.stack });
    }
});

// ── GET /api/pipeline/cards/:id/stats — Stats for the card's Statistics tab ──
pipelineRouter.get('/api/pipeline/cards/:id/stats', async (req: Request, res: Response) => {
    try {
        const cardId = Number(req.params.id);

        // Get the orcamento variacao_maxima for fallback pricing
        const [orc] = await db.select({ variacao_maxima: orcamentos.variacao_maxima })
            .from(orcamentos)
            .where(eq(orcamentos.id, cardId));

        const markup = orc?.variacao_maxima ? Number(orc.variacao_maxima) : 0;

        // Get all items
        const items = await db.select()
            .from(itens_orcamento)
            .where(eq(itens_orcamento.orcamento_id, cardId));

        const itemCount = items.length;

        if (itemCount === 0) {
            return res.json({ item_count: 0, total_compra: null, total_venda: null, lucro: null, lucro_percent: null, comissao: null });
        }

        let totalCompra = 0;
        let totalVenda = 0;

        for (const item of items) {
            const qty = Number(item.quantidade) || 0;
            const compra = Number(item.valor_compra) || 0;
            const venda = item.valor_venda ? Number(item.valor_venda) : compra * (1 + markup / 100);
            totalCompra += qty * compra;
            totalVenda += qty * venda;
        }

        const lucro = totalVenda - totalCompra;
        const lucroPercent = totalCompra > 0 ? (lucro / totalCompra) * 100 : 0;
        const comissao = lucro * 0.1; // 10% commission default

        res.json({
            item_count: itemCount,
            total_compra: totalCompra,
            total_venda: totalVenda,
            lucro,
            lucro_percent: lucroPercent,
            comissao,
        });
    } catch (e) {
        console.error('Card stats error:', e);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// ── GET /api/pipeline/cards/:id/detail — Single card detail for validation ──
pipelineRouter.get('/api/pipeline/cards/:id/detail', async (req: Request, res: Response) => {
    try {
        const cardId = Number(req.params.id);
        const [card] = await db.select().from(orcamentos).where(eq(orcamentos.id, cardId));
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    } catch (e) {
        console.error('Card detail error:', e);
        res.status(500).json({ error: 'Failed to load card detail' });
    }
});

// ── GET /api/pipeline/stream — SSE ──
pipelineRouter.get('/api/pipeline/stream', (req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

// ── PATCH /api/pipeline/cards/:id/move — Move card between stages ──
pipelineRouter.patch('/api/pipeline/cards/:id/move', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { stage, position } = req.body;

        if (!STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const [existing] = await db.select().from(orcamentos).where(eq(orcamentos.id, cardId));
        if (!existing) return res.status(404).json({ error: 'Card not found' });

        const oldStage = existing.stage;

        await db.update(orcamentos).set({
            stage,
            position: position ?? 0,
            updated_by: currentUser.id,
            updated_at: new Date(),
        }).where(eq(orcamentos.id, cardId));

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'move_card',
            entity: 'orcamento',
            entityId: cardId,
            details: `Card "${existing.titulo}" movido de ${oldStage} → ${stage}`,
            oldData: { stage: oldStage },
            newData: { stage },
            ipAddress: req.ip ?? null,
        });

        broadcastSSE('card_moved', { cardId, stage, position, movedBy: currentUser.username });
        res.json({ success: true });
    } catch (e) {
        console.error('Move card error:', e);
        res.status(500).json({ error: 'Failed to move card' });
    }
});

// ── PATCH /api/pipeline/cards/:id — Update card details ──
pipelineRouter.patch('/api/pipeline/cards/:id', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { description, deadline, outcome, delivery_type, delivery_target, links } = req.body;

        const updateData: any = {
            updated_by: currentUser.id,
            updated_at: new Date(),
        };

        if (description !== undefined) updateData.description = description;
        if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
        if (outcome !== undefined) updateData.outcome = outcome || null;
        if (delivery_type !== undefined) updateData.delivery_type = delivery_type || null;
        if (delivery_target !== undefined) updateData.delivery_target = delivery_target?.trim() || null;
        if (links !== undefined) updateData.links = links;

        await db.update(orcamentos).set(updateData).where(eq(orcamentos.id, cardId));

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'update',
            entity: 'orcamento',
            entityId: cardId,
            details: `Card atualizado (fields: ${Object.keys(req.body).join(', ')})`,
            newData: req.body,
            ipAddress: req.ip ?? null,
        });

        broadcastSSE('card_updated', { cardId, ...req.body, updatedBy: currentUser.username });
        res.json({ success: true });
    } catch (e) {
        console.error('Update card error:', e);
        res.status(500).json({ error: 'Failed to update card' });
    }
});

// ── POST /api/pipeline/cards/:id/assign — Assign user ──
pipelineRouter.post('/api/pipeline/cards/:id/assign', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { user_id } = req.body;

        await db.update(orcamentos).set({
            assigned_to: user_id || null,
            updated_by: currentUser.id,
            updated_at: new Date(),
        }).where(eq(orcamentos.id, cardId));

        const assigneeName = user_id
            ? (await db.select({ username: usuarios.username }).from(usuarios).where(eq(usuarios.id, user_id)))[0]?.username
            : null;

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'assign_card',
            entity: 'orcamento',
            entityId: cardId,
            details: assigneeName ? `Card atribuído para ${assigneeName}` : 'Atribuição removida',
            newData: { assigned_to: user_id },
            ipAddress: req.ip ?? null,
        });

        broadcastSSE('card_assigned', { cardId, user_id, assigneeName });
        res.json({ success: true });
    } catch (e) {
        console.error('Assign card error:', e);
        res.status(500).json({ error: 'Failed to assign' });
    }
});

// ── Labels CRUD ──
pipelineRouter.get('/api/pipeline/labels', async (_req: Request, res: Response) => {
    const allLabels = await db.select().from(labels).orderBy(asc(labels.name));
    res.json({ labels: allLabels });
});

pipelineRouter.post('/api/pipeline/labels', async (req: Request, res: Response) => {
    try {
        const { name, color } = req.body;
        const [result] = await db.insert(labels).values({ name, color: color || '#3b82f6' });
        const newLabel = await db.select().from(labels).where(eq(labels.id, result.insertId));
        broadcastSSE('label_created', newLabel[0]);
        res.json({ success: true, label: newLabel[0] });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create label' });
    }
});

pipelineRouter.put('/api/pipeline/labels/:id', async (req: Request, res: Response) => {
    try {
        const { name, color } = req.body;
        await db.update(labels).set({ name, color }).where(eq(labels.id, Number(req.params.id)));
        broadcastSSE('label_updated', { id: Number(req.params.id), name, color });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update label' });
    }
});

pipelineRouter.delete('/api/pipeline/labels/:id', async (req: Request, res: Response) => {
    try {
        await db.delete(labels).where(eq(labels.id, Number(req.params.id)));
        broadcastSSE('label_deleted', { id: Number(req.params.id) });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete label' });
    }
});

// ── Card Labels ──
pipelineRouter.post('/api/pipeline/cards/:id/labels', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { label_id } = req.body;

        await db.insert(orcamento_labels).values({ orcamento_id: cardId, label_id })
            .onDuplicateKeyUpdate({ set: { label_id } });

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'add_label',
            entity: 'orcamento',
            entityId: cardId,
            details: `Label #${label_id} adicionada`,
            ipAddress: req.ip ?? null,
        });

        broadcastSSE('card_label_added', { cardId, label_id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add label' });
    }
});

pipelineRouter.delete('/api/pipeline/cards/:id/labels/:labelId', async (req: Request, res: Response) => {
    try {
        const cardId = Number(req.params.id);
        const labelId = Number(req.params.labelId);
        await db.delete(orcamento_labels)
            .where(and(
                eq(orcamento_labels.orcamento_id, cardId),
                eq(orcamento_labels.label_id, labelId)
            ));
        broadcastSSE('card_label_removed', { cardId, labelId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove label' });
    }
});

// ── Comments ──
pipelineRouter.get('/api/pipeline/cards/:id/comments', async (req: Request, res: Response) => {
    try {
        const cardId = Number(req.params.id);
        const cardComments = await db.select({
            id: comments.id,
            body: comments.body,
            parent_id: comments.parent_id,
            created_at: comments.created_at,
            user_id: comments.user_id,
            username: usuarios.username,
            nome_completo: usuarios.nome_completo,
        })
        .from(comments)
        .innerJoin(usuarios, eq(comments.user_id, usuarios.id))
        .where(and(
            eq(comments.orcamento_id, cardId),
            isNull(comments.deleted_at)
        ))
        .orderBy(asc(comments.created_at));

        res.json({ comments: cardComments });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load comments' });
    }
});

pipelineRouter.post('/api/pipeline/cards/:id/comments', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { body, parent_id } = req.body;

        if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });

        const [result] = await db.insert(comments).values({
            orcamento_id: cardId,
            user_id: currentUser.id,
            parent_id: parent_id || null,
            body: body.trim(),
        });

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'add_comment',
            entity: 'orcamento',
            entityId: cardId,
            details: `Comentário adicionado ao card #${cardId}`,
            ipAddress: req.ip ?? null,
        });

        const newComment = {
            id: result.insertId,
            body: body.trim(),
            parent_id: parent_id || null,
            created_at: new Date(),
            user_id: currentUser.id,
            username: currentUser.username,
        };

        broadcastSSE('comment_added', { cardId, comment: newComment });
        res.json({ success: true, comment: newComment });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

pipelineRouter.delete('/api/pipeline/comments/:id', async (req: Request, res: Response) => {
    try {
        const commentId = Number(req.params.id);
        await db.update(comments).set({ deleted_at: new Date() }).where(eq(comments.id, commentId));
        broadcastSSE('comment_deleted', { commentId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ── Users List (for assign & @mention) ──
pipelineRouter.get('/api/pipeline/users', async (_req: Request, res: Response) => {
    const allUsers = await db.select({
        id: usuarios.id,
        username: usuarios.username,
        nome_completo: usuarios.nome_completo,
    }).from(usuarios).where(isNull(usuarios.deleted_at));
    res.json({ users: allUsers });
});

// ── Reorder cards within a stage ──
pipelineRouter.post('/api/pipeline/reorder', async (req: Request, res: Response) => {
    try {
        const { cardIds, stage } = req.body;
        if (!Array.isArray(cardIds) || !STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid data' });
        }

        await db.transaction(async (tx) => {
            for (let i = 0; i < cardIds.length; i++) {
                await tx.update(orcamentos).set({
                    position: i,
                    stage,
                }).where(eq(orcamentos.id, cardIds[i]));
            }
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to reorder' });
    }
});

// ── GET /api/pipeline/enviados/stats — Summary counts for glance card ──
pipelineRouter.get('/api/pipeline/enviados/stats', async (_req: Request, res: Response) => {
    try {
        const [total] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(orcamentos)
            .where(and(eq(orcamentos.stage, 'enviados'), isNull(orcamentos.deleted_at)));

        const [won] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(orcamentos)
            .where(and(eq(orcamentos.stage, 'enviados'), eq(orcamentos.outcome, 'won'), isNull(orcamentos.deleted_at)));

        const [lost] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(orcamentos)
            .where(and(eq(orcamentos.stage, 'enviados'), eq(orcamentos.outcome, 'lost'), isNull(orcamentos.deleted_at)));

        const [pending] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(orcamentos)
            .where(and(
                eq(orcamentos.stage, 'enviados'),
                isNull(orcamentos.deleted_at),
                sql`(outcome IS NULL OR outcome = '' OR outcome = 'pending')`,
            ));

        res.json({
            total: Number(total.count),
            won: Number(won.count),
            lost: Number(lost.count),
            pending: Number(pending.count),
        });
    } catch (e) {
        console.error('Enviados stats error:', e);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// ── GET /api/pipeline/enviados — Paginated enviados list ──
pipelineRouter.get('/api/pipeline/enviados', async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = (req.query.search as string || '').trim();
        const outcome = req.query.outcome as string || '';
        const assignee = req.query.assignee as string || '';
        const sortBy = req.query.sortBy as string || 'updated_at';
        const sortDir = req.query.sortDir as string || 'desc';

        // Build conditions
        const conditions = [
            eq(orcamentos.stage, 'enviados'),
            isNull(orcamentos.deleted_at),
        ];

        if (search) {
            conditions.push(sql`(titulo LIKE ${'%' + search + '%'} OR solicitante_nome LIKE ${'%' + search + '%'})`);
        }

        if (outcome === 'won' || outcome === 'lost') {
            conditions.push(eq(orcamentos.outcome, outcome));
        } else if (outcome === 'pending') {
            conditions.push(sql`(outcome IS NULL OR outcome = '' OR outcome = 'pending')`);
        }

        if (assignee) {
            conditions.push(eq(orcamentos.assigned_to, Number(assignee)));
        }

        const whereClause = and(...conditions);

        // Count total
        const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
            .from(orcamentos).where(whereClause);
        const totalCount = Number(countResult.count);
        const totalPages = Math.ceil(totalCount / limit);

        // Sort
        const validSorts: Record<string, any> = {
            titulo: orcamentos.titulo,
            updated_at: orcamentos.updated_at,
            deadline: orcamentos.deadline,
            created_at: orcamentos.created_at,
        };
        const sortColumn = validSorts[sortBy] || orcamentos.updated_at;
        const orderFn = sortDir === 'asc' ? asc : desc;

        // Fetch rows
        const rows = await db.select({
            id: orcamentos.id,
            titulo: orcamentos.titulo,
            solicitante_nome: orcamentos.solicitante_nome,
            deadline: orcamentos.deadline,
            assigned_to: orcamentos.assigned_to,
            outcome: orcamentos.outcome,
            updated_at: orcamentos.updated_at,
            created_at: orcamentos.created_at,
        })
        .from(orcamentos)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset);

        // Get assignee names
        const allUsers = await db.select({
            id: usuarios.id,
            username: usuarios.username,
            nome_completo: usuarios.nome_completo,
        }).from(usuarios).where(isNull(usuarios.deleted_at));
        const usersMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

        // Get labels for these rows
        const rowIds = rows.map(r => r.id);
        let rowLabels: any[] = [];
        if (rowIds.length > 0) {
            rowLabels = await db.select({
                orcamento_id: orcamento_labels.orcamento_id,
                label_name: labels.name,
                label_color: labels.color,
            })
            .from(orcamento_labels)
            .innerJoin(labels, eq(orcamento_labels.label_id, labels.id))
            .where(inArray(orcamento_labels.orcamento_id, rowIds));
        }

        const labelsMap: Record<number, any[]> = {};
        for (const rl of rowLabels) {
            if (!labelsMap[rl.orcamento_id]) labelsMap[rl.orcamento_id] = [];
            labelsMap[rl.orcamento_id].push({ name: rl.label_name, color: rl.label_color });
        }

        const enrichedRows = rows.map(r => ({
            ...r,
            assignee: r.assigned_to ? usersMap[r.assigned_to] || null : null,
            labels: labelsMap[r.id] || [],
        }));

        res.json({
            rows: enrichedRows,
            page,
            totalPages,
            totalCount,
        });
    } catch (e) {
        console.error('Enviados list error:', e);
        res.status(500).json({ error: 'Failed to load enviados' });
    }
});

// ══════════════════════════════════════════════════════════════
// ACTIVITY LOGGING HELPER
// ══════════════════════════════════════════════════════════════

async function logActivity(params: {
    orcamentoId: number;
    userId?: number | null;
    type: string;
    parentActivityId?: number | null;
    metadata?: any;
}) {
    const [result] = await db.insert(card_activities).values({
        orcamento_id: params.orcamentoId,
        user_id: params.userId ?? null,
        type: params.type,
        parent_activity_id: params.parentActivityId ?? null,
        metadata: params.metadata ?? null,
    } as any);
    return (result as any).insertId as number;
}

// ── GET /api/pipeline/cards/:id/activities — Activity timeline ──
pipelineRouter.get('/api/pipeline/cards/:id/activities', async (req: Request, res: Response) => {
    try {
        const cardId = Number(req.params.id);

        const activities = await db.select({
            id: card_activities.id,
            type: card_activities.type,
            parent_activity_id: card_activities.parent_activity_id,
            metadata: card_activities.metadata,
            created_at: card_activities.created_at,
            user_id: card_activities.user_id,
            username: usuarios.username,
            nome_completo: usuarios.nome_completo,
        })
        .from(card_activities)
        .leftJoin(usuarios, eq(card_activities.user_id, usuarios.id))
        .where(eq(card_activities.orcamento_id, cardId))
        .orderBy(desc(card_activities.created_at));

        // Structure: top-level activities with children nested
        const topLevel: any[] = [];
        const childrenMap: Record<number, any[]> = {};

        for (const a of activities) {
            if (a.parent_activity_id) {
                if (!childrenMap[a.parent_activity_id]) childrenMap[a.parent_activity_id] = [];
                childrenMap[a.parent_activity_id].push(a);
            }
        }

        for (const a of activities) {
            if (!a.parent_activity_id) {
                topLevel.push({
                    ...a,
                    children: (childrenMap[a.id] || []).sort((x: any, y: any) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()),
                });
            }
        }

        res.json({ activities: topLevel });
    } catch (e) {
        console.error('Activities error:', e);
        res.status(500).json({ error: 'Failed to load activities' });
    }
});

// ── POST /api/pipeline/cards/:id/log-activity — Log PDF generation or other events ──
pipelineRouter.post('/api/pipeline/cards/:id/log-activity', async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const { type, metadata } = req.body;

        const id = await logActivity({
            orcamentoId: cardId,
            userId: currentUser.id,
            type,
            metadata,
        });

        res.json({ success: true, id });
    } catch (e) {
        console.error('Log activity error:', e);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// ══════════════════════════════════════════════════════════════
// EMAIL QUEUE — Send Emails Endpoint + Processor
// ══════════════════════════════════════════════════════════════

const queueUpload = multer({ storage: multer.memoryStorage() });
const queuePdfFields = queueUpload.fields([
    { name: 'pdf1', maxCount: 1 },
    { name: 'pdf2', maxCount: 1 },
    { name: 'pdf3', maxCount: 1 },
]);

// ── POST /api/pipeline/cards/:id/send-emails — Queue 3 emails with random delays ──
pipelineRouter.post('/api/pipeline/cards/:id/send-emails', queuePdfFields, async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.currentUser;
        const cardId = Number(req.params.id);
        const recipientEmail = req.body.recipient_email;

        if (!recipientEmail) {
            return res.status(400).json({ success: false, message: 'Email do destinatário é obrigatório.' });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files?.pdf1?.[0] || !files?.pdf2?.[0] || !files?.pdf3?.[0]) {
            return res.status(400).json({ success: false, message: 'Os 3 PDFs são obrigatórios.' });
        }

        // Validate card has 3 companies
        const [card] = await db.select().from(orcamentos).where(eq(orcamentos.id, cardId));
        if (!card) return res.status(404).json({ success: false, message: 'Orçamento não encontrado.' });
        if (!card.empresa1_id || !card.empresa2_id || !card.empresa3_id) {
            return res.status(400).json({ success: false, message: 'Selecione as 3 empresas no orçamento antes de enviar.' });
        }

        // Create parent activity: email_requested
        const parentActivityId = await logActivity({
            orcamentoId: cardId,
            userId: currentUser.id,
            type: 'email_requested',
            metadata: { recipient: recipientEmail },
        });

        // Generate random delays: 0min, 1-5min, (previous + 1-5min)
        const delays = [0];
        delays.push(delays[0] + (Math.floor(Math.random() * 5) + 1)); // 1-5 min after first
        delays.push(delays[1] + (Math.floor(Math.random() * 5) + 1)); // 1-5 min after second

        const now = new Date();
        const pdfKeys = ['pdf1', 'pdf2', 'pdf3'] as const;
        const scheduledTimes: Date[] = [];

        for (let i = 0; i < 3; i++) {
            const scheduledAt = new Date(now.getTime() + delays[i] * 60 * 1000);
            scheduledTimes.push(scheduledAt);

            // Create sub-activity: email_pending
            const subActivityId = await logActivity({
                orcamentoId: cardId,
                userId: currentUser.id,
                type: 'email_pending',
                parentActivityId,
                metadata: { company_index: i + 1, scheduled_at: scheduledAt.toISOString() },
            });

            // Convert PDF buffer to base64 for storage
            const pdfBase64 = files[pdfKeys[i]][0].buffer.toString('base64');

            // Insert into email_queue
            await db.insert(email_queue).values({
                orcamento_id: cardId,
                company_index: i + 1,
                activity_id: subActivityId,
                recipient_email: recipientEmail,
                status: 'pending',
                scheduled_at: scheduledAt,
                pdf_data: pdfBase64,
            } as any);
        }

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'email_requested',
            entity: 'orcamento',
            entityId: cardId,
            details: `Disparos de email solicitados para ${recipientEmail} (delays: ${delays.map(d => d + 'min').join(', ')})`,
            newData: { recipientEmail, delays, scheduledTimes: scheduledTimes.map(d => d.toISOString()) },
            ipAddress: req.ip ?? null,
        });

        broadcastSSE('card_updated', { cardId, type: 'email_queued' });

        res.json({
            success: true,
            message: `Fila de envio criada! ${delays.map((d, i) => `Email ${i + 1}: ${d === 0 ? 'agora' : `em ${d} min`}`).join(', ')}.`,
            scheduled: scheduledTimes.map(d => d.toISOString()),
        });

    } catch (e: any) {
        console.error('Send emails queue error:', e);
        res.status(500).json({ success: false, message: 'Erro ao criar fila de envio: ' + e.message });
    }
});

// ── Email Queue Processor — runs every 15 seconds ──
async function processEmailQueue() {
    try {
        const now = new Date();

        // Find pending emails that are ready to send
        const pendingEmails = await db.select()
            .from(email_queue)
            .where(and(
                eq(email_queue.status, 'pending'),
                lte(email_queue.scheduled_at, now),
            ))
            .limit(5);

        for (const item of pendingEmails) {
            try {
                // Get the orcamento + company
                const [orc] = await db.select().from(orcamentos).where(eq(orcamentos.id, item.orcamento_id));
                if (!orc) {
                    await db.update(email_queue).set({ status: 'failed', error: 'Orçamento não encontrado' }).where(eq(email_queue.id, item.id));
                    continue;
                }

                const companyIds = [orc.empresa1_id, orc.empresa2_id, orc.empresa3_id];
                const companyId = companyIds[item.company_index - 1];
                if (!companyId) {
                    await db.update(email_queue).set({ status: 'failed', error: `Empresa ${item.company_index} não configurada` }).where(eq(email_queue.id, item.id));
                    if (item.activity_id) {
                        await db.update(card_activities).set({
                            type: 'email_failed',
                            metadata: { company_index: item.company_index, error: `Empresa ${item.company_index} não configurada` },
                        } as any).where(eq(card_activities.id, item.activity_id));
                    }
                    continue;
                }

                const [company] = await db.select().from(empresas).where(eq(empresas.id, companyId));
                if (!company || !company.smtp_host || !company.smtp_user || !company.smtp_pass) {
                    const err = !company ? 'Empresa não encontrada' : 'SMTP não configurado';
                    await db.update(email_queue).set({ status: 'failed', error: err }).where(eq(email_queue.id, item.id));
                    if (item.activity_id) {
                        await db.update(card_activities).set({
                            type: 'email_failed',
                            metadata: { company_index: item.company_index, company_name: company?.nome, error: err },
                        } as any).where(eq(card_activities.id, item.activity_id));
                    }
                    continue;
                }

                // Create transporter
                const transporter = nodemailer.createTransport({
                    host: company.smtp_host,
                    port: Number.parseInt(company.smtp_port || '587'),
                    secure: company.smtp_secure === 'ssl',
                    auth: { user: company.smtp_user, pass: company.smtp_pass },
                });

                // Randomized subject
                const subjectTemplates = [
                    `Orçamento - ${orc.titulo} - ${company.nome}`,
                    `Proposta Comercial - ${orc.titulo}`,
                    `Cotação de Preços - ${orc.titulo} | ${company.nome}`,
                    `Envio de Orçamento: ${orc.titulo}`,
                    `${company.nome} - Orçamento Ref. ${orc.titulo}`,
                    `Proposta de Fornecimento - ${orc.titulo}`,
                    `Orçamento para ${orc.titulo} - ${company.nome}`,
                    `Cotação: ${orc.titulo} | Ref. ${company.nome}`,
                    `Apresentação de Proposta - ${orc.titulo}`,
                    `${company.nome} | Cotação - ${orc.titulo}`,
                    `Proposta de Preços - ${orc.titulo}`,
                    `Orçamento Comercial: ${orc.titulo} - ${company.nome}`,
                ];
                const subject = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];

                // Randomized body
                const nome = company.nome;
                const doc = company.documento || '';
                const email = company.email || '';
                const tel = company.telefone || '';
                const sol = orc.solicitante_nome || '';
                const titulo = orc.titulo;

                const assinatura = (fields: ('doc' | 'email' | 'tel')[]) => {
                    let sig = `<p><strong>${nome}</strong></p>`;
                    if (fields.includes('doc') && doc) sig += `<p>CNPJ: ${doc}</p>`;
                    if (fields.includes('email') && email) sig += `<p>${email}</p>`;
                    if (fields.includes('tel') && tel) sig += `<p>Tel: ${tel}</p>`;
                    return sig;
                };

                const bodyTemplates = [
                    `<p>Prezado(a),</p><p>Encaminhamos em anexo nosso orçamento referente a <strong>${titulo}</strong>.</p><p>Ficamos à disposição para quaisquer esclarecimentos.</p><p>Atenciosamente,</p>${assinatura(['doc', 'email', 'tel'])}`,
                    `<p>Prezado(a),</p><p>Conforme solicitado, segue anexo o orçamento da empresa <strong>${nome}</strong> para o processo: <strong>${titulo}</strong>.</p><p>Cordialmente,</p>${assinatura(['doc'])}`,
                    `<p>Prezado(a),</p><p>Segue em anexo nossa proposta comercial referente a: <strong>${titulo}</strong>.</p>${sol ? `<p>Solicitante: ${sol}</p>` : ''}<p>Permanecemos à disposição.</p><p>Atenciosamente,</p>${assinatura(['doc', 'tel'])}`,
                    `<p>Prezado Senhor(a),</p><p>Vimos por meio deste apresentar nossa cotação de preços para <strong>${titulo}</strong>, conforme documento em anexo.</p><p>Sem mais para o momento,</p>${assinatura(['doc', 'email'])}`,
                    `<p>Prezado(a),</p><p>Enviamos em anexo o orçamento solicitado referente a <strong>${titulo}</strong>.</p><p>Quaisquer dúvidas, estamos à disposição.</p><p>Att,</p>${assinatura(['email', 'tel'])}`,
                    `<p>Prezado(a),</p><p>Em atenção à solicitação de cotação, encaminhamos anexo nosso orçamento para <strong>${titulo}</strong>.</p><p>Colocamo-nos à inteira disposição.</p><p>Respeitosamente,</p>${assinatura(['doc'])}`,
                    `<p>Prezado(a),</p><p>É com satisfação que apresentamos nossa proposta para <strong>${titulo}</strong>, conforme arquivo anexo.</p>${sol ? `<p>Ref. Solicitante: ${sol}</p>` : ''}<p>Atenciosamente,</p>${assinatura(['doc', 'email', 'tel'])}`,
                    `<p>A/C Setor de Compras,</p><p>Segue proposta de preços da <strong>${nome}</strong> referente a <strong>${titulo}</strong>.</p><p>Aguardamos retorno. Desde já agradecemos a oportunidade.</p><p>Atenciosamente,</p>${assinatura(['doc', 'email'])}`,
                ];
                const html = bodyTemplates[Math.floor(Math.random() * bodyTemplates.length)];

                // Decode PDF from base64
                const pdfBuffer = Buffer.from(item.pdf_data!, 'base64');
                const safeCompanyName = nome.replace(/[^a-zA-Z0-9]/g, '_');

                await transporter.sendMail({
                    from: company.smtp_user,
                    to: item.recipient_email,
                    subject,
                    html,
                    attachments: [{
                        filename: `orcamento_${safeCompanyName}.pdf`,
                        content: pdfBuffer,
                    }],
                });

                // Success — update queue + activity
                await db.update(email_queue).set({
                    status: 'sent',
                    sent_at: new Date(),
                    pdf_data: null, // clear the blob to save space
                }).where(eq(email_queue.id, item.id));

                if (item.activity_id) {
                    await db.update(card_activities).set({
                        type: 'email_sent',
                        metadata: { company_index: item.company_index, company_name: company.nome, sent_at: new Date().toISOString(), subject },
                    } as any).where(eq(card_activities.id, item.activity_id));
                }

                broadcastSSE('card_updated', { cardId: item.orcamento_id, type: 'email_sent', company_index: item.company_index });
                console.log(`[EmailQueue] ✅ Sent email ${item.company_index}/3 for orcamento #${item.orcamento_id} via ${company.nome}`);

            } catch (emailErr: any) {
                console.error(`[EmailQueue] ❌ Failed email ${item.company_index}/3 for orcamento #${item.orcamento_id}:`, emailErr.message);
                await db.update(email_queue).set({
                    status: 'failed',
                    error: emailErr.message,
                }).where(eq(email_queue.id, item.id));

                if (item.activity_id) {
                    await db.update(card_activities).set({
                        type: 'email_failed',
                        metadata: { company_index: item.company_index, error: emailErr.message },
                    } as any).where(eq(card_activities.id, item.activity_id));
                }

                broadcastSSE('card_updated', { cardId: item.orcamento_id, type: 'email_failed', company_index: item.company_index });
            }
        }
    } catch (e) {
        console.error('[EmailQueue] Processor error:', e);
    }
}

// Start queue processor — check every 15 seconds
setInterval(processEmailQueue, 15_000);
console.log('[EmailQueue] Processor started (15s interval)');
