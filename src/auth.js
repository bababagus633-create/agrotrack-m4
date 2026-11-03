import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';

export function authenticate(secret) {
  return (req, _res, next) => {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Token tidak ada.'));
    try {
      const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (!p.sub || !p.role) throw new Error('claim');
      req.user = { sub: String(p.sub), role: p.role, token };
      next();
    } catch {
      next(new AppError(401, 'UNAUTHENTICATED', 'Token tidak valid atau kedaluwarsa.'));
    }
  };
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role)
    ? next()
    : next(new AppError(403, 'FORBIDDEN', 'Peran tidak berhak melakukan aksi ini.'));
