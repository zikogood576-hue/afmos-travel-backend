import pg from 'pg';
import { env } from './env.js';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

// Utiliser connectionString directement : pg parse l'URL sans erreur.
// "Tenant or user not found" : utilisez la chaîne EXACTE du dashboard Supabase
// (Connect > Session pooler) — la région (aws-0-REGION) doit correspondre au projet.
// Render = IPv4 only → obligatoirement Session pooler (port 5432), pas direct.
const connectionString = env.DATABASE_URL.replace(/^postgres:/, 'postgresql:');

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Échec connexion PostgreSQL :', err.message);
    if (err.message?.includes('Tenant or user not found')) {
      console.error('   → Vérifiez la chaîne du dashboard Supabase (Connect > Session pooler)');
      console.error('   → La région (aws-0-xxx) doit correspondre à celle du projet.');
    }
  } else {
    console.log('✅ Connexion PostgreSQL établie avec succès');
    release();
  }
});

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}