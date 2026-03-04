import { Router } from 'express';
import { db } from '../db';
import { usuarios } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../middleware/auth';
import { logAudit } from '../lib/audit';

export const usuariosRouter = Router();

// All routes require admin
usuariosRouter.use(requireAdmin);

// GET /usuarios - List users
usuariosRouter.get('/', async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        nome_completo: usuarios.nome_completo,
        role: usuarios.role,
        created_at: usuarios.created_at,
        deleted_at: usuarios.deleted_at,
      })
      .from(usuarios)
      .where(isNull(usuarios.deleted_at));

    res.render('user_list', { users: allUsers });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao listar usuários');
  }
});

// GET /usuarios/form - Create/edit user form
usuariosRouter.get('/form', async (req, res) => {
  try {
    const id = req.query.id as string;
    let user: Record<string, any> | null = null;

    if (id) {
      const found = await db
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, Number.parseInt(id)));
      if (found.length > 0) user = found[0];
    }

    res.render('user_form', { user: user || {} });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro no formulário de usuário');
  }
});

// POST /usuarios/save
usuariosRouter.post('/save', async (req, res) => {
  try {
    const { id, username, password, nome_completo, role } = req.body;
    const currentUser = res.locals.currentUser;

    if (id) {
      // Update
      const existing = await db.select().from(usuarios).where(eq(usuarios.id, Number.parseInt(id)));
      if (existing.length === 0) return res.redirect('/usuarios');

      const updatePayload: Record<string, any> = {
        username,
        nome_completo: nome_completo || null,
        role: role || 'user',
        updated_by: currentUser.id,
        updated_at: new Date(),
      };

      if (password && password.trim() !== '') {
        updatePayload.password_hash = await bcrypt.hash(password, 10);
      }

      await db.update(usuarios).set(updatePayload).where(eq(usuarios.id, Number.parseInt(id)));

      await logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        action: 'update',
        entity: 'usuario',
        entityId: Number.parseInt(id),
        details: `Usuário "${username}" atualizado`,
        oldData: { username: existing[0].username, role: existing[0].role, nome_completo: existing[0].nome_completo },
        newData: { username, role: role || 'user', nome_completo },
        ipAddress: req.ip ?? null,
      });
    } else {
      // Create
      if (!username || !password) {
        return res.status(400).send('Usuário e senha são obrigatórios.');
      }

      const hash = await bcrypt.hash(password, 10);

      const [result] = await db.insert(usuarios).values({
        username,
        password_hash: hash,
        nome_completo: nome_completo || null,
        role: role || 'user',
        created_by: currentUser.id,
      });

      await logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        action: 'create',
        entity: 'usuario',
        entityId: result.insertId,
        details: `Usuário "${username}" criado com role "${role || 'user'}"`,
        newData: { username, role: role || 'user', nome_completo },
        ipAddress: req.ip ?? null,
      });
    }

    res.redirect('/usuarios');
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao salvar usuário');
  }
});

// POST /usuarios/delete (soft delete)
usuariosRouter.post('/delete', async (req, res) => {
  try {
    const id = Number.parseInt(req.body.id);
    const currentUser = res.locals.currentUser;

    if (id === currentUser.id) {
      return res.status(400).send('Você não pode desativar a si mesmo.');
    }

    const existing = await db.select().from(usuarios).where(eq(usuarios.id, id));
    if (existing.length === 0) return res.redirect('/usuarios');

    await db.update(usuarios).set({
      deleted_at: new Date(),
      deleted_by: currentUser.id,
    }).where(eq(usuarios.id, id));

    await logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      action: 'delete',
      entity: 'usuario',
      entityId: id,
      details: `Usuário "${existing[0].username}" desativado (soft delete)`,
      oldData: { username: existing[0].username, role: existing[0].role },
      ipAddress: req.ip ?? null,
    });

    res.redirect('/usuarios');
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao desativar usuário');
  }
});
