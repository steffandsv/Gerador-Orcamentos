import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, desc, like, sql } from 'drizzle-orm';

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
        
        res.render('quote_list', { orcamentos: results }); // Converted to EJS
    } catch (e) {
        console.error(e);
        res.status(500).send("Database error listing quotes");
    }
});

// POST /orcamentos/delete
orcamentosRouter.post('/delete', async (req, res) => {
    try {
        const id = req.body.id;
        if (id) {
            // In Drizzle, cascade delete is configured in schema if set, but we can do it explicitly
            await db.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, parseInt(id)));
            await db.delete(orcamentos).where(eq(orcamentos.id, parseInt(id)));
        }
        res.redirect('/?page=orcamentos');
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
            empresa1_id: parseInt(req.body.empresa1_id),
            empresa2_id: parseInt(req.body.empresa2_id),
            empresa3_id: parseInt(req.body.empresa3_id),
            template1_id: parseInt(req.body.template1_id) || 1,
            template2_id: parseInt(req.body.template2_id) || 2,
            template3_id: parseInt(req.body.template3_id) || 3,
            variacao_maxima: req.body.variacao_maxima,
            solicitante_nome: req.body.solicitante_nome || null,
            solicitante_cnpj: req.body.solicitante_cnpj || null
        };

        const items = req.body.items || [];
        const quote_id = req.body.quote_id;

        await db.transaction(async (tx) => {
            let orcamento_id: number;

            if (quote_id) {
                // Update
                orcamento_id = parseInt(quote_id);
                await tx.update(orcamentos).set(payload).where(eq(orcamentos.id, orcamento_id));
                // Delete old items
                await tx.delete(itens_orcamento).where(eq(itens_orcamento.orcamento_id, orcamento_id));
            } else {
                // Insert
                const [result] = await tx.insert(orcamentos).values(payload);
                orcamento_id = result.insertId;
            }

            // Insert new items
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

        res.redirect('/?page=orcamentos');
    } catch (e) {
        console.error(e);
        res.status(500).send("Error saving quote");
    }
});
