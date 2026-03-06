import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { pool } from '../../config/db.js';
import { unauthorized, forbidden } from '../../utils/errors.js';
import { logActivity } from '../activityLogs/activityLogs.service.js';

export async function loginWithAccessCode({ username, accessCode }) {
  const { rows } = await pool.query(
    `select id, username, full_name, role, access_code_hash, is_active
     from public.users
     where username = $1`,
    [username]
  );
  const user = rows[0];
  if (!user) throw unauthorized('Identifiants invalides');
  if (!user.is_active) throw forbidden('Compte désactivé');

  const ok = await bcrypt.compare(accessCode, user.access_code_hash);
  if (!ok) throw unauthorized('Identifiants invalides');

  const token = jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  await pool.query(`update public.users set last_login_at = now(), updated_at = now() where id = $1`, [
    user.id
  ]);
  await logActivity({ userId: user.id, actionType: 'LOGIN', entityType: 'USER', entityId: user.id });

  return {
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role }
  };
}

export async function hashAccessCode(accessCode) {
  const saltRounds = 10;
  return bcrypt.hash(accessCode, saltRounds);
}

