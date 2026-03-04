import { Router } from 'express';
import { db } from '../db';
import { audit_log } from '../db/schema';
import { desc } from 'drizzle-orm';

export const auditRouter = Router();

// GET /auditoria - Show audit log
auditRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const logs = await db
      .select()
      .from(audit_log)
      .orderBy(desc(audit_log.created_at))
      .limit(limit)
      .offset(offset);

    res.render('audit_log', { logs, page });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao carregar logs de auditoria');
  }
});
