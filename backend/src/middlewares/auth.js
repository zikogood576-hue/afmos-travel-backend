import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) return next(unauthorized('Token manquant'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.auth = { userId: payload.sub, role: payload.role, username: payload.username };
    return next();
  } catch {
    return next(unauthorized('Token invalide'));
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return next(unauthorized('Non authentifié'));
    if (req.auth.role !== role) return next(forbidden('Rôle insuffisant'));
    return next();
  };
}

