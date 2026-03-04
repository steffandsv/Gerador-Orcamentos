import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq } from 'drizzle-orm';
import seedrandom from 'seedrandom';

export const printRouter = Router();

// GET /print?id=X&company_index=Y
printRouter.get('/', async (req, res) => {
    try {
        const quote_id = parseInt(req.query.id as string);
        const comp_idx = parseInt(req.query.company_index as string) || 1;

        if (!quote_id) return res.status(400).send("Orçamento não encontrado.");

        // Fetch Quote
        const quoteRecords = await db.select().from(orcamentos).where(eq(orcamentos.id, quote_id));
        if (quoteRecords.length === 0) return res.status(404).send("Orçamento não encontrado.");
        const quote = quoteRecords[0];

        // Determine Company ID
        const company_field = `empresa${comp_idx}_id` as keyof typeof quote;
        const company_id = quote[company_field] as number;

        if (!company_id) return res.status(400).send("Empresa reference invalid.");

        // Fetch Company
        const companyRecords = await db.select().from(empresas).where(eq(empresas.id, company_id));
        if (companyRecords.length === 0) return res.status(404).send("Empresa não encontrada.");
        const company = companyRecords[0];

        // Fetch Items
        const items = await db.select().from(itens_orcamento).where(eq(itens_orcamento.orcamento_id, quote_id));

        // Calculate Prices
        const processedItems = items.map(item => {
            let final_price = Number(item.valor_venda || item.valor_compra);
            
            if (comp_idx !== 1) {
                // Loser - Random Increase
                // Deterministic Seed mimicking PHP mt_srand:
                const seedString = `${quote_id}${comp_idx}${item.id}`;
                const rng = seedrandom(seedString);
                
                const max_var = Number(quote.variacao_maxima);
                // PHP generated random percent between 10 and max_var*10, e.g., 10 to 150 = 1.0 to 15.0
                // Math.floor(rng() * (max - min + 1)) + min
                const minVal = 10;
                const maxVal = Math.floor(max_var * 10);
                
                let random_percent = 0;
                if (maxVal >= minVal) {
                    random_percent = Math.floor(rng() * (maxVal - minVal + 1)) + minVal;
                }
                random_percent = random_percent / 10; // 1.0 to 15.0

                final_price = final_price * (1 + (random_percent / 100));
            }

            const total_price = final_price * Number(item.quantidade);

            return {
                ...item,
                final_price,
                total_price
            };
        });

        // Display ID Offset Logic
        let offset = 0;
        if (comp_idx === 1) offset = 50;
        else if (comp_idx === 2) offset = 150;
        else if (comp_idx === 3) offset = 280;

        const displayQuote = {
            ...quote,
            id: quote.id + offset
        };

        // Select Layout
        const tpl_field = `template${comp_idx}_id` as keyof typeof quote;
        const template_id = quote[tpl_field] || comp_idx;

        const layout_file = `print_layout_${template_id}`;

        res.render(layout_file, {
            quote: displayQuote,
            company,
            items: processedItems,
            comp_idx
        });

    } catch (e) {
        console.error(e);
        res.status(500).send("Server error generating print");
    }
});
