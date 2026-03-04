import { Router } from 'express';
import { db } from '../db';
import { orcamentos, empresas, itens_orcamento } from '../db/schema';
import { eq, like, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { logAudit } from '../lib/audit';

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
        const currentUser = res.locals.currentUser;
        const { host, port, user, pass, secure } = req.body;
        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure === 'ssl' || secure === 'true',
            auth: { user, pass }
        });

        await transporter.verify();

        await logAudit({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'test_smtp',
            entity: 'smtp',
            details: `Teste SMTP realizado: ${host}:${port} (user: ${user})`,
            ipAddress: req.ip ?? null,
        });

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
        const currentUser = res.locals.currentUser;
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

                // --- Randomized subject templates ---
                const subjectTemplates = [
                    `Orçamento - ${quote.titulo} - ${company.nome}`,
                    `Proposta Comercial - ${quote.titulo}`,
                    `Cotação de Preços - ${quote.titulo} | ${company.nome}`,
                    `Envio de Orçamento: ${quote.titulo}`,
                    `${company.nome} - Orçamento Ref. ${quote.titulo}`,
                    `Proposta de Fornecimento - ${quote.titulo}`,
                    `Orçamento para ${quote.titulo} - ${company.nome}`,
                    `Cotação: ${quote.titulo} | Ref. ${company.nome}`,
                    `Apresentação de Proposta - ${quote.titulo}`,
                    `${company.nome} | Cotação - ${quote.titulo}`,
                    `Proposta de Preços - ${quote.titulo}`,
                    `Orçamento Comercial: ${quote.titulo} - ${company.nome}`,
                ];
                const subject = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];

                // --- Randomized body templates ---
                const titulo = quote.titulo;
                const nome = company.nome;
                const doc = company.documento || '';
                const email = company.email || '';
                const tel = company.telefone || '';
                const sol = quote.solicitante_nome || '';

                const assinatura = (fields: ('doc' | 'email' | 'tel')[]) => {
                    let sig = `<p><strong>${nome}</strong></p>`;
                    if (fields.includes('doc') && doc) sig += `<p>CNPJ: ${doc}</p>`;
                    if (fields.includes('email') && email) sig += `<p>${email}</p>`;
                    if (fields.includes('tel') && tel) sig += `<p>Tel: ${tel}</p>`;
                    return sig;
                };

                const bodyTemplates = [
                    `<p>Prezado(a),</p>
                     <p>Encaminhamos em anexo nosso orçamento referente a <strong>${titulo}</strong>.</p>
                     <p>Ficamos à disposição para quaisquer esclarecimentos.</p>
                     <p>Atenciosamente,</p>${assinatura(['doc', 'email', 'tel'])}`,

                    `<p>Prezado(a),</p>
                     <p>Conforme solicitado, segue anexo o orçamento da empresa <strong>${nome}</strong> para o processo: <strong>${titulo}</strong>.</p>
                     <p>Cordialmente,</p>${assinatura(['doc'])}`,

                    `<p>Prezado(a),</p>
                     <p>Segue em anexo nossa proposta comercial referente a: <strong>${titulo}</strong>.</p>
                     ${sol ? `<p>Solicitante: ${sol}</p>` : ''}
                     <p>Permanecemos à disposição.</p>
                     <p>Atenciosamente,</p>${assinatura(['doc', 'tel'])}`,

                    `<p>Prezado Senhor(a),</p>
                     <p>Vimos por meio deste apresentar nossa cotação de preços para <strong>${titulo}</strong>, conforme documento em anexo.</p>
                     <p>Sem mais para o momento,</p>${assinatura(['doc', 'email'])}`,

                    `<p>Prezado(a),</p>
                     <p>Enviamos em anexo o orçamento solicitado referente a <strong>${titulo}</strong>.</p>
                     <p>Quaisquer dúvidas, estamos à disposição.</p>
                     <p>Att,</p>${assinatura(['email', 'tel'])}`,

                    `<p>Prezado(a),</p>
                     <p>Em atenção à solicitação de cotação, encaminhamos anexo nosso orçamento para <strong>${titulo}</strong>.</p>
                     <p>Colocamo-nos à inteira disposição.</p>
                     <p>Respeitosamente,</p>${assinatura(['doc'])}`,

                    `<p>Prezado(a),</p>
                     <p>É com satisfação que apresentamos nossa proposta para <strong>${titulo}</strong>, conforme arquivo anexo.</p>
                     ${sol ? `<p>Ref. Solicitante: ${sol}</p>` : ''}
                     <p>Atenciosamente,</p>${assinatura(['doc', 'email', 'tel'])}`,

                    `<p>Prezado(a),</p>
                     <p>Temos a satisfação de enviar nosso orçamento para o processo <strong>${titulo}</strong>.</p>
                     <p>Esperamos atender às expectativas. Estamos à disposição para negociações.</p>
                     <p>Cordialmente,</p>${assinatura(['tel'])}`,

                    `<p>A/C Setor de Compras,</p>
                     <p>Segue proposta de preços da <strong>${nome}</strong> referente a <strong>${titulo}</strong>.</p>
                     <p>Aguardamos retorno. Desde já agradecemos a oportunidade.</p>
                     <p>Atenciosamente,</p>${assinatura(['doc', 'email'])}`,

                    `<p>Prezado(a),</p>
                     <p>Conforme demanda, anexamos nossa cotação relativa a <strong>${titulo}</strong>.</p>
                     <p>Nos colocamos à disposição para eventuais ajustes.</p>
                     <p>Att,</p>${assinatura(['doc', 'tel'])}`,
                ];
                const html = bodyTemplates[Math.floor(Math.random() * bodyTemplates.length)];

                const pdfBuffer = files[pdfKeys[i]][0].buffer;
                const safeCompanyName = nome.replace(/[^a-zA-Z0-9]/g, '_');

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

                await logAudit({
                    userId: currentUser.id,
                    username: currentUser.username,
                    action: 'send_email',
                    entity: 'orcamento',
                    entityId: quoteId,
                    details: `Email enviado para ${recipientEmail} via ${company.nome} (${company.smtp_user})`,
                    newData: { recipientEmail, company: company.nome, subject },
                    ipAddress: req.ip ?? null,
                });

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
