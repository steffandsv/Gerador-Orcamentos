import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, like, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import multer from 'multer';

export const apiRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/search_solicitante
apiRouter.get('/search_solicitante', async (req, res) => {
    try {
        const term = req.query.term as string || '';
        if (term.length < 2) {
            return res.json([]);
        }

        const results = await db.selectDistinct({
            solicitante_nome: orcamentos.solicitante_nome,
            solicitante_cnpj: orcamentos.solicitante_cnpj
        })
        .from(orcamentos)
        .where(like(orcamentos.solicitante_nome, `%${term}%`))
        .limit(10);

        res.json(results);
    } catch (e) {
        res.status(500).json([]);
    }
});

// POST /api/test_smtp
apiRouter.post('/test_smtp', async (req, res) => {
    try {
        const { host, port, user, pass, secure } = req.body;
        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure === 'ssl' || secure === 'true',
            auth: { user, pass }
        });

        await transporter.verify();
        res.json({ success: true, message: 'Conexão SMTP bem-sucedida! Pronto para enviar e-mails.' });
    } catch (e: any) {
        res.json({ success: false, message: 'Erro de conexão: ' + e.message });
    }
});

// POST /api/send_budget
const pdfFields = upload.fields([
    { name: 'pdf1', maxCount: 1 },
    { name: 'pdf2', maxCount: 1 },
    { name: 'pdf3', maxCount: 1 }
]);

apiRouter.post('/send_budget', pdfFields, async (req, res) => {
    try {
        const quoteId = parseInt(req.body.quote_id);
        const recipientEmail = req.body.recipient_email;

        if (!quoteId || !recipientEmail) {
            return res.json({ success: false, message: 'Parâmetros inválidos (quote_id ou recipient_email).' });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (!files?.pdf1?.[0] || !files?.pdf2?.[0] || !files?.pdf3?.[0]) {
            return res.json({ success: false, message: 'Os 3 PDFs são obrigatórios.' });
        }

        // Fetch quote
        const quoteRecords = await db.select().from(orcamentos).where(eq(orcamentos.id, quoteId));
        if (quoteRecords.length === 0) {
            return res.json({ success: false, message: 'Orçamento não encontrado.' });
        }
        const quote = quoteRecords[0];

        // Fetch winning company (empresa1) for SMTP settings
        const companyRecords = await db.select().from(empresas).where(eq(empresas.id, quote.empresa1_id));
        if (companyRecords.length === 0) {
            return res.json({ success: false, message: 'Empresa vencedora não encontrada.' });
        }
        const company = companyRecords[0];

        if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
            return res.json({ success: false, message: 'Configurações SMTP da empresa não definidas. Configure o SMTP na página de edição da empresa.' });
        }

        // Create transporter from company SMTP settings
        const transporter = nodemailer.createTransport({
            host: company.smtp_host,
            port: parseInt(company.smtp_port || '587'),
            secure: company.smtp_secure === 'ssl',
            auth: {
                user: company.smtp_user,
                pass: company.smtp_pass
            }
        });

        // Build email
        const subject = `Orçamentos - ${quote.titulo}`;
        const html = `
            <p>Prezado(a),</p>
            <p>Segue em anexo os orçamentos referentes a: <strong>${quote.titulo}</strong></p>
            ${quote.solicitante_nome ? `<p>Solicitante: ${quote.solicitante_nome}</p>` : ''}
            <p>Atenciosamente,</p>
            <p><strong>${company.nome}</strong></p>
        `;

        const attachments = [
            { filename: `orcamento_1_${company.nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: files.pdf1[0].buffer },
        ];

        // Fetch company names for attachment filenames
        const company2Records = await db.select().from(empresas).where(eq(empresas.id, quote.empresa2_id));
        const company3Records = await db.select().from(empresas).where(eq(empresas.id, quote.empresa3_id));
        const company2Name = company2Records[0]?.nome || 'Empresa2';
        const company3Name = company3Records[0]?.nome || 'Empresa3';

        attachments.push(
            { filename: `orcamento_2_${company2Name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: files.pdf2[0].buffer },
            { filename: `orcamento_3_${company3Name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: files.pdf3[0].buffer }
        );

        await transporter.sendMail({
            from: company.smtp_user,
            to: recipientEmail,
            subject,
            html,
            attachments
        });

        res.json({ success: true, message: `E-mail enviado com sucesso para ${recipientEmail}!` });

    } catch (e: any) {
        console.error('send_budget error:', e);
        res.json({ success: false, message: 'Erro ao enviar e-mail: ' + e.message });
    }
});
