import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import session from 'express-session';

dotenv.config();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'docs');
fs.mkdirSync(uploadsDir, { recursive: true });

import { empresasRouter } from './routes/empresas';
import { orcamentosRouter } from './routes/orcamentos';
import { orcamentosApiRouter } from './routes/orcamentos-api';
import { printRouter } from './routes/print';
import { apiRouter } from './routes/api';
import { authRouter } from './routes/auth';
import { usuariosRouter } from './routes/usuarios';
import { auditRouter } from './routes/auditoria';
import { pipelineRouter } from './routes/pipeline';
import { requireAuth, injectUser } from './middleware/auth';

const app = express();
const port = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Trust proxy for req.ip behind reverse proxies
app.set('trust proxy', 1);

// Static files - style.css, js/, arquivos/ live at project root (one level up from dist/)
app.use(express.static(path.join(__dirname, '..')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        httpOnly: true,
    }
}));

// Auth routes (public — login/logout)
app.use(authRouter);

// All routes below require authentication
app.use(requireAuth);

// Inject user into all views
app.use(injectUser);

// Modular routers
app.use('/empresas', empresasRouter);
app.use('/orcamentos', orcamentosRouter);
app.use('/print', printRouter);
app.use('/api', apiRouter);
app.use('/api', orcamentosApiRouter);
app.use('/usuarios', usuariosRouter);
app.use('/auditoria', auditRouter);
app.use(pipelineRouter);

// Homepage — Pipeline Board (legacy fallback for old bookmarks)
app.get('/', async (req, res) => {
    const page = (req.query.page as string) || 'home';

    if (page === 'empresas') return res.redirect('/empresas');
    if (page === 'empresa_form') return res.redirect(`/empresas/form?id=${String(req.query.id || '')}`);
    if (page === 'orcamentos') return res.redirect('/orcamentos');
    if (page === 'orcamento_form') return res.redirect(`/orcamentos/form?id=${String(req.query.id || '')}`);

    res.redirect('/pipeline');
});

// Global error handler — always verbose (even in production, per user request)
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: err.stack,
        details: err.details || null,
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
