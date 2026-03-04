import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    };
    return next();
  }
  res.redirect('/login');
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (res.locals.currentUser?.role === 'admin') {
    return next();
  }
  res.status(403).send('Acesso negado. Somente administradores podem acessar esta página.');
}

export function injectUser(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    };
  }
  next();
}
