import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSanitizedSupabaseUrl } from './config';

/**
 * Crea un cliente Supabase con el contexto de seguridad de la Estación (Tatami, Pesaje, etc.)
 * inyectando el token JWT generado en /api/auth/station-login.
 *
 * Todas las peticiones ejecutadas por este cliente cumplirán automáticamente
 * con las políticas RLS restringidas a la organización de la estación.
 */
export function createStationClient(accessToken: string) {
  const supabaseUrl = getSanitizedSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });
}
