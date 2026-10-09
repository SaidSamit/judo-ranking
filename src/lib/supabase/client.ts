import { createBrowserClient } from '@supabase/ssr';
import { getSanitizedSupabaseUrl } from './config';

/**
 * Cliente de Supabase para Client Components (Frontend / PWA).
 * Utiliza cookies del navegador para persistir la sesión de forma transparente.
 */
export function createClient() {
  const supabaseUrl = getSanitizedSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
