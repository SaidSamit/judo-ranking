import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase con privilegios administrativos (Service Role Key).
 * ADVERTENCIA: Este cliente bypasses Row-Level Security (RLS).
 * Utilizar ÚNICAMENTE en el backend (Route Handlers seguros) y NUNCA exponer al cliente.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
