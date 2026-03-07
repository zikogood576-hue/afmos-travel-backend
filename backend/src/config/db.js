import pg from 'pg';
import { env } from './env.js';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

// ✅ Parser l'URL manuellement pour éviter les problèmes d'encodage
// du username "postgres.xxxxx" avec le point (.)
const url = new URL(env.DATABASE_URL);

export const pool = new Pool({
  host:     url.hostname,
  port:     parseInt(url.port) || 5432,
  database: url.pathname.replace('/', ''),
  user:     decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl:      { rejectUnauthorized: false },
  max:      5,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 15_000
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Échec connexion PostgreSQL :', err.message);
    console.error('   host:', url.hostname);
    console.error('   port:', url.port);
    console.error('   user:', decodeURIComponent(url.username));
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