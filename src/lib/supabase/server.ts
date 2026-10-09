import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSanitizedSupabaseUrl } from './config';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers estándar.
 * Gestiona lectura y escritura de cookies de sesión con soporte para Next.js 14 y 15.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = getSanitizedSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // El método `setAll` fue invocado desde un Server Component.
          // Esto puede ignorarse si hay un middleware refrescando sesiones.
        }
      },
    },
  });
}
