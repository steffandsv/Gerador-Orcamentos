import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

import { empresasRouter } from './routes/empresas';
import { orcamentosRouter } from './routes/orcamentos';
import { printRouter } from './routes/print';
import { apiRouter } from './routes/api';

const app = express();
const port = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files - style.css, js/, arquivos/ live at project root (one level up from dist/)
app.use(express.static(path.join(__dirname, '..')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Modular routers
app.use('/empresas', empresasRouter);
app.use('/orcamentos', orcamentosRouter);
app.use('/print', printRouter);
app.use('/api', apiRouter);

// Homepage & legacy fallback routing
app.get('/', async (req, res) => {
    const page = (req.query.page as string) || 'home';

    if (page === 'empresas') return res.redirect('/empresas');
    if (page === 'empresa_form') return res.redirect(`/empresas/form?id=${String(req.query.id || '')}`);
    if (page === 'orcamentos') return res.redirect('/orcamentos');
    if (page === 'orcamento_form') {
        const id = String(req.query.id || '');
        res.render('quote_form', { id });
        return;
    }

    res.render('index', { page });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
