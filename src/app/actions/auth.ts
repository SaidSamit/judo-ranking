// ==============================================================================
// SERVER ACTIONS: AUTENTICACIÓN INSTITUCIONAL (ADMIN & TATAMI DINÁMICO)
// ==============================================================================
//
// ARQUITECTURA DE AUTO-ENRUTAMIENTO:
// 1. Login de Administración (Director de Torneo / Comisión):
//    - Verifica credenciales maestras de administración.
//    - Redirige a /admin/tournaments (Menú de Campeonatos).
//
// 2. Login de Mesa de Tatami (Credencial Única con Auto-Enrutamiento):
//    - Recibe el Usuario / Identificador de Estación (ej: "tatami-1", "tatami-2", "1")
//      y la Contraseña / PIN (4 a 6 dígitos).
//    - Busca en la tabla 'stations' la estación activa y valida su hash bcrypt.
//    - Auto-enruta dinámicamente al tablero correspondiente (/tatami/[id]).
//
// ==============================================================================

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AdminLoginResult {
  success: boolean;
  message?: string;
  redirectTo?: string;
}

export interface TatamiLoginResult {
  success: boolean;
  tatamiNumber?: number;
  message?: string;
  redirectTo?: string;
}

/**
 * Autentica al Director de Torneo / Administrador mediante Supabase Auth y la tabla profiles.
 */
export async function loginAdminAction(
  formData: FormData
): Promise<AdminLoginResult> {
  const rawUsername = (formData.get('username') as string || '').trim().toLowerCase();
  const password = (formData.get('password') as string || '').trim();

  if (!rawUsername || !password) {
    return {
      success: false,
      message: 'Ingresa tu usuario / email y contraseña de administración.',
    };
  }

  const email = rawUsername.includes('@') ? rawUsername : `${rawUsername}@judo.cl`;

  try {
    const supabase = createAdminClient();

    // 1. Intentar iniciar sesión oficial con Supabase Auth
    let authUser: any = null;
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInErr && signInData.user) {
      authUser = signInData.user;
    } else {
      // 2. Si no existe usuario en Supabase Auth y se ingresan credenciales iniciales de Director
      const validMasters = ['admin', 'director', 'comision', 'judo'];
      const isMasterUser = validMasters.includes(rawUsername) || rawUsername === 'admin@judo.cl';
      const isMasterPass = password === 'admin2026' || password === 'admin' || password === '1234';

      if (isMasterUser && isMasterPass) {
        // Auto-provisionar usuario en auth.users
        const securePassword = password.length >= 6 ? password : 'admin2026';
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password: securePassword,
          email_confirm: true,
          user_metadata: { role: 'ADMIN', first_name: 'Director', last_name: 'Torneo' },
        });

        if (created?.user) {
          authUser = created.user;

          // Insertar en la tabla profiles de la organización
          await supabase.from('profiles').upsert(
            {
              id: authUser.id,
              organization_id: 'a0000000-0000-0000-0000-000000000001',
              role: 'ADMIN',
              first_name: 'Director',
              last_name: 'Torneo',
              email,
            },
            { onConflict: 'id' }
          );
        } else if (createErr) {
          console.warn('[loginAdminAction] Auto-provisioning info:', createErr.message);
        }
      }
    }

    // 3. Validar perfil en la tabla profiles si tenemos usuario autenticado
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', authUser.id)
        .maybeSingle();

      const userRole = profile?.role || 'ADMIN';

      if (userRole !== 'ADMIN') {
        return {
          success: false,
          message: 'Tu cuenta no posee permisos de Director o Administrador.',
        };
      }
    } else {
      return {
        success: false,
        message: 'Credenciales inválidas. Usa usuario "admin" y clave "admin2026".',
      };
    }

    // 4. Establecer cookie de sesión de administración
    const cookieStore = await cookies();
    cookieStore.set('judo_admin_role', 'DIRECTOR', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 días
    });

    cookieStore.set('judo_admin_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: 'Sesión de Director iniciada correctamente.',
      redirectTo: '/admin/tournaments',
    };
  } catch (err: any) {
    console.error('[loginAdminAction] Error inesperado:', err);
    return {
      success: false,
      message: 'Error autenticando la sesión en el servidor.',
    };
  }
}

/**
 * Cierra la sesión de administración eliminando las cookies del navegador.
 */
export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('judo_admin_role');
  cookieStore.delete('judo_admin_email');
  redirect('/');
}

/**
 * Normaliza el identificador de estación ingresado por el operador.
 * Admite formatos como: "tatami-1", "tatami 1", "tatami1", "1", "mesa-1", "mesa 1".
 */
function normalizeStationIdentifier(raw: string): { slug: string; candidateNumber: number } {
  const clean = raw.trim().toLowerCase();

  // Extraer el primer número presente en la cadena
  const digitsMatch = clean.match(/\d+/);
  const number = digitsMatch ? parseInt(digitsMatch[0], 10) : 1;

  // Formatear a slug estándar del sistema
  const slug = `tatami-${number}`;

  return { slug, candidateNumber: number };
}

/**
 * Autentica la sesión de Mesa con Auto-Enrutamiento a partir de Usuario + PIN.
 */
export async function loginTatamiAction(
  identifier: string,
  pin: string,
  organizationId: string = 'a0000000-0000-0000-0000-000000000001'
): Promise<TatamiLoginResult> {
  const cleanId = (identifier || '').trim();
  const cleanPin = (pin || '').trim();

  if (!cleanId) {
    return {
      success: false,
      message: 'Por favor ingresa el identificador de la estación (ej: tatami-1).',
    };
  }

  if (!cleanPin || cleanPin.length < 4) {
    return {
      success: false,
      message: 'Por favor ingresa el PIN numérico de la estación (mínimo 4 dígitos).',
    };
  }

  const { slug, candidateNumber } = normalizeStationIdentifier(cleanId);

  try {
    const supabase = createAdminClient();

    // 1. Buscar estación: primero en el torneo activo, luego a nivel general
    let matchedStation: any = null;

    // a. Obtener campeonato activo
    const { data: activeTour } = await supabase
      .from('tournaments')
      .select('id')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTour?.id) {
      try {
        const { data: tourStations } = await supabase
          .from('stations')
          .select('id, name, slug, tatami_number, pin_hash, pin_code, is_active')
          .eq('tournament_id', activeTour.id)
          .eq('type', 'TATAMI_TABLE')
          .eq('is_active', true);

        if (tourStations && tourStations.length > 0) {
          matchedStation = tourStations.find(
            (s) =>
              s.slug.toLowerCase() === slug.toLowerCase() ||
              s.slug.toLowerCase() === cleanId.toLowerCase() ||
              s.tatami_number === candidateNumber
          );
        }
      } catch {
        // Ignorar si la columna tournament_id aún no fue migrada
      }
    }

    // b. Si no se encontró por torneo, buscar en estaciones generales
    if (!matchedStation) {
      const { data: stations } = await supabase
        .from('stations')
        .select('id, name, slug, tatami_number, pin_hash, pin_code, is_active')
        .eq('organization_id', organizationId)
        .eq('type', 'TATAMI_TABLE')
        .eq('is_active', true);

      if (stations && stations.length > 0) {
        matchedStation = stations.find(
          (s) =>
            s.slug.toLowerCase() === slug.toLowerCase() ||
            s.slug.toLowerCase() === cleanId.toLowerCase() ||
            s.tatami_number === candidateNumber
        );
      }
    }

    if (matchedStation) {
      let isPinValid = false;

      // Validación directa contra pin_code o contra pin_hash (bcrypt)
      if (matchedStation.pin_code && matchedStation.pin_code === cleanPin) {
        isPinValid = true;
      } else if (matchedStation.pin_hash) {
        try {
          isPinValid = await bcrypt.compare(cleanPin, matchedStation.pin_hash);
        } catch {
          isPinValid = false;
        }

        if (!isPinValid && matchedStation.pin_hash === cleanPin) {
          isPinValid = true;
        }
      }

      if (isPinValid) {
        const resolvedNumber = matchedStation.tatami_number || candidateNumber || 1;

        // Guardar cookie de estación
        const cookieStore = await cookies();
        cookieStore.set('tatami_session_slug', matchedStation.slug, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        return {
          success: true,
          tatamiNumber: resolvedNumber,
          redirectTo: `/tatami/${resolvedNumber}`,
          message: `Credencial validada para ${matchedStation.name}. Enrutando a tablero...`,
        };
      }
    }
  } catch (err) {
    console.warn('Verificación en Supabase omitida por modo offline:', err);
  }

  // Respaldo exclusivamente para entorno de desarrollo local si se usa el PIN maestro '1234'
  if (process.env.NODE_ENV !== 'production' && cleanPin === '1234') {
    const cookieStore = await cookies();
    cookieStore.set('tatami_session_slug', slug, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      tatamiNumber: candidateNumber,
      redirectTo: `/tatami/${candidateNumber}`,
      message: `Acceso concedido en modo desarrollo a Tatami #${candidateNumber}.`,
    };
  }

  return {
    success: false,
    message: `Identificador o PIN incorrecto para "${cleanId}". Consulta la hoja de credenciales del Director.`,
  };
}

/**
 * Server Action para formulario directo (Server Action Form Binding con redirect nativo)
 */
export async function loginTatamiFormAction(formData: FormData) {
  const identifier = (formData.get('identifier') as string || '').trim();
  const pin = (formData.get('pin') as string || '').trim();

  const res = await loginTatamiAction(identifier, pin);

  if (res.success && res.redirectTo) {
    redirect(res.redirectTo);
  }

  return res;
}
