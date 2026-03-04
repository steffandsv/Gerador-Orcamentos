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
        const quoteId = Number.parseInt(req.body.quote_id);
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

        // Fetch all 3 companies
        const companyIds = [quote.empresa1_id, quote.empresa2_id, quote.empresa3_id];
        const pdfKeys = ['pdf1', 'pdf2', 'pdf3'] as const;
        const results: string[] = [];
        let allSuccess = true;

        for (let i = 0; i < 3; i++) {
            const companyRecords = await db.select().from(empresas).where(eq(empresas.id, companyIds[i]));
            if (companyRecords.length === 0) {
                results.push(`Empresa ${i + 1}: não encontrada.`);
                allSuccess = false;
                continue;
            }
            const company = companyRecords[0];

            if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
                results.push(`${company.nome}: SMTP não configurado.`);
                allSuccess = false;
                continue;
            }

            try {
                const transporter = nodemailer.createTransport({
                    host: company.smtp_host,
                    port: Number.parseInt(company.smtp_port || '587'),
                    secure: company.smtp_secure === 'ssl',
                    auth: {
                        user: company.smtp_user,
                        pass: company.smtp_pass
                    }
                });

                const subject = `Orçamento - ${quote.titulo} - ${company.nome}`;
                const html = `
                    <p>Prezado(a),</p>
                    <p>Segue em anexo o orçamento da empresa <strong>${company.nome}</strong> referente a: <strong>${quote.titulo}</strong></p>
                    ${quote.solicitante_nome ? `<p>Solicitante: ${quote.solicitante_nome}</p>` : ''}
                    <p>Atenciosamente,</p>
                    <p><strong>${company.nome}</strong></p>
                    ${company.documento ? `<p>CNPJ: ${company.documento}</p>` : ''}
                    ${company.email ? `<p>E-mail: ${company.email}</p>` : ''}
                    ${company.telefone ? `<p>Tel: ${company.telefone}</p>` : ''}
                `;

                const pdfBuffer = files[pdfKeys[i]][0].buffer;
                const safeCompanyName = company.nome.replace(/[^a-zA-Z0-9]/g, '_');

                await transporter.sendMail({
                    from: company.smtp_user,
                    to: recipientEmail,
                    subject,
                    html,
                    attachments: [{
                        filename: `orcamento_${safeCompanyName}.pdf`,
                        content: pdfBuffer
                    }]
                });

                results.push(`${company.nome}: ✅ Enviado.`);
            } catch (emailErr: any) {
                results.push(`${company.nome}: ❌ ${emailErr.message}`);
                allSuccess = false;
            }
        }

        res.json({
            success: allSuccess,
            message: allSuccess
                ? `Todos os 3 e-mails enviados com sucesso para ${recipientEmail}!`
                : 'Alguns e-mails falharam. Veja os detalhes.',
            details: results
        });

    } catch (e: any) {
        console.error('send_budget error:', e);
        res.json({ success: false, message: 'Erro ao enviar e-mails: ' + e.message });
    }
});
