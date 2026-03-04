import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { db } from './db';
import { empresas, orcamentos, itens_orcamento } from './db/schema';
import { eq, desc } from 'drizzle-orm';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));

// Serve existing static files
// We will move "js", "arquivos", "style.css" to a "public" folder later or serve them from root. 
// Assuming they are in the project root:
app.use(express.static(path.join(__dirname, '../../')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

import { empresasRouter } from './routes/empresas';
import { orcamentosRouter } from './routes/orcamentos';
import { printRouter } from './routes/print';
import { apiRouter } from './routes/api';

// Use modular routers
app.use('/empresas', empresasRouter);
app.use('/orcamentos', orcamentosRouter);
app.use('/print', printRouter);
app.use('/api', apiRouter);

// Global Router Fallback logic for ?page=...
app.get('/', async (req, res) => {
    const page = (req.query.page as string) || 'home';
    
    // Simulating old PHP index.php fallback routing into new modular patterns
    if (page === 'empresas') return res.redirect('/empresas');
    if (page === 'empresa_form') return res.redirect(`/empresas/form?id=${req.query.id || ''}`);
    if (page === 'orcamentos') return res.redirect('/orcamentos');
    if (page === 'orcamento_form') {
        const id = req.query.id || '';
        // We need an endpoint for orcamentos/form to render. I will add it back to the fallback or the router.
        res.render('quote_form.php', { id }); // Will be converted later
        return;
    }
    
    res.render('index.php', { page });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
