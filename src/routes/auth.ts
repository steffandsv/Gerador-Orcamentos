import { Router } from 'express';
import { db } from '../db';
import { usuarios } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logAudit } from '../lib/audit';

export const authRouter = Router();

// GET /login
authRouter.get('/login', (req, res) => {
  if (req.session?.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// POST /login
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Preencha usuário e senha.' });
    }

    const found = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.username, username))
      .limit(1);

    if (found.length === 0) {
      return res.render('login', { error: 'Usuário ou senha inválidos.' });
    }

    const user = found[0];

    if (user.deleted_at) {
      return res.render('login', { error: 'Usuário desativado.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.render('login', { error: 'Usuário ou senha inválidos.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'login',
      entity: 'session',
      details: 'Login realizado com sucesso',
      ipAddress: req.ip ?? null,
    });

    res.redirect('/');
  } catch (e) {
    console.error('Login error:', e);
    res.render('login', { error: 'Erro interno. Tente novamente.' });
  }
});

// POST /logout
authRouter.post('/logout', async (req, res) => {
  if (req.session?.userId) {
    await logAudit({
      userId: req.session.userId,
      username: req.session.username || 'unknown',
      action: 'logout',
      entity: 'session',
      details: 'Logout realizado',
      ipAddress: req.ip ?? null,
    });
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});
