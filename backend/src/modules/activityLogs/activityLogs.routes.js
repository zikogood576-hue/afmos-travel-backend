import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { pool } from '../../config/db.js';

export const activityLogsRouter = Router();

// Lecture des logs (ADMIN)
activityLogsRouter.get('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const { rows } = await pool.query(
      `select id, user_id, action_type, entity_type, entity_id, metadata, created_at
       from public.activity_logs
       order by created_at desc
       limit $1 offset $2`,
      [limit, offset]
    );
    res.json({ items: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

