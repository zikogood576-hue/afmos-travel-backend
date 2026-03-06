import { pool } from '../../config/db.js';

export async function logActivity({
  userId,
  actionType,
  entityType = null,
  entityId = null,
  metadata = {}
}) {
  await pool.query(
    `insert into public.activity_logs (user_id, action_type, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [userId, actionType, entityType, entityId, JSON.stringify(metadata)]
  );
}

