import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const orcamentosRouter = Router();

// GET /orcamentos - List Quotes
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
        const allEmpresas = await db.select().from(empresas);

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

// POST /orcamentos/delete
orcamentosRouter.post('/delete', async (req, res) => {
    try {
        const id = req.body.id;
        if (id) {
            await db.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, Number.parseInt(id)));
            await db.delete(orcamentos).where(eq(orcamentos.id, Number.parseInt(id)));
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
                await tx.update(orcamentos).set(payload).where(eq(orcamentos.id, orcamento_id));
                await tx.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, orcamento_id));
            } else {
                const [result] = await tx.insert(orcamentos).values(payload);
                orcamento_id = result.insertId;
            }

            if (items.length > 0) {
                const itemsToInsert = items
                    .filter((item: any) => item.descricao)
                    .map((item: any) => ({
                        orcamento_id,
                        descricao: item.descricao,
                        unidade: item.unidade || 'UN',
                        quantidade: item.quantidade,
                        preco_unitario: item.preco_unitario
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
