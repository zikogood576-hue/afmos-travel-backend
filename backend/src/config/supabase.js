import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Utilisé surtout pour Storage (photos) et appels admin si nécessaire.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

