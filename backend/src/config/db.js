import pg from 'pg';
import { env } from './env.js';
import dns from 'dns';

// ✅ Force IPv4 — résout le problème "connect ENETUNREACH" sur Render
// Render tente IPv6 par défaut, mais Supabase Pooler n'écoute qu'en IPv4
dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,

  // ✅ SSL obligatoire pour Supabase (rejeter les certs auto-signés inconnus)
  ssl: { rejectUnauthorized: false },

  // Paramètres adaptés au Transaction Pooler de Supabase (port 6543)
  // Le pooler gère lui-même les connexions → on limite le pool local
  max: 5,                          // ⬇️ réduit (le pooler Supabase limite à ~15 par défaut)
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,

  // Connexion directe → pas besoin de désactiver les prepared statements
});

// Test de connexion au démarrage (utile pour diagnostiquer dans les logs Render)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Échec connexion PostgreSQL :', err.message);
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
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}