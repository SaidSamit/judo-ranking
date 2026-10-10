// ==============================================================================
// SERVER ACTION: CONFIRMACIÓN E INSERCIÓN MASIVA DE INSCRIPCIONES
// ==============================================================================
//
// ¿POR QUÉ UN SERVER ACTION PARA EL ENVÍO MASIVO?
// 1. Ejecución Transaccional Segura: En lugar de hacer docenas de peticiones HTTP
//    individuales desde el navegador, el cliente envía el arreglo completo del
//    "Estado Borrador" en una sola invocación RPC.
// 2. Manejo de Dependencias Relacionales: En el backend se resuelven atómicamente
//    las dependencias de clave foránea:
//    - Categorías (crea las categorías no existentes para el torneo)
//    - Clubes (crea clubes si no existen en la organización)
//    - Atletas (upsert por organization_id + rut_dni)
//    - Inscripciones (upsert en tournament_registrations)
// 3. Credenciales Protegidas: Utiliza createAdminClient() con Service Role Key,
//    evitando exponer permisos de inserción múltiple en claves anónimas del cliente.
//
// ==============================================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface DraftAthletePayload {
  id?: string;
  name: string;
  club_name?: string;
  category: string;
  rut_dni: string;
  gender: 'M' | 'F';
  birth_year?: number;
  birth_date?: string;
  weight?: number;
  seed?: number;
}

export interface ConfirmRegistrationsResult {
  success: boolean;
  count: number;
  message: string;
  error?: string;
}

export async function confirmRegistrationsAction(
  athletes: DraftAthletePayload[],
  organizationId: string = 'a0000000-0000-0000-0000-000000000001',
  tournamentId: string = 'e0000000-0000-0000-0000-000000000001'
): Promise<ConfirmRegistrationsResult> {
  if (!athletes || athletes.length === 0) {
    return {
      success: false,
      count: 0,
      message: 'No hay atletas en el estado borrador para confirmar.',
      error: 'La lista de atletas está vacía.',
    };
  }

  try {
    const supabase = createAdminClient();

    // ========================================================================
    // 1. RESOLVER O CREAR CATEGORÍAS
    // ========================================================================
    const uniqueCategoryNames = Array.from(
      new Set(athletes.map((a) => (a.category || 'Categoría Abierta').trim()).filter(Boolean))
    );

    const { data: existingCategories, error: catFetchError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('tournament_id', tournamentId);

    if (catFetchError) {
      throw new Error(`Error consultando categorías: ${catFetchError.message}`);
    }

    const categoryNameToId = new Map<string, string>();
    (existingCategories || []).forEach((c) => {
      categoryNameToId.set(c.name.trim().toLowerCase(), c.id);
    });

    const missingCategoryNames = uniqueCategoryNames.filter(
      (name) => !categoryNameToId.has(name.toLowerCase())
    );

    if (missingCategoryNames.length > 0) {
      const categoriesToInsert = missingCategoryNames.map((catName) => {
        const lower = catName.toLowerCase();
        const ageGroup = lower.includes('infantil')
          ? 'Infantil'
          : lower.includes('junior')
          ? 'Junior'
          : lower.includes('senior')
          ? 'Senior'
          : 'Cadetes';

        return {
          organization_id: organizationId,
          tournament_id: tournamentId,
          name: catName,
          age_group: ageGroup,
          gender: 'M',
          match_duration_seconds: 240,
          is_official: true,
        };
      });

      const { data: insertedCats, error: catInsertError } = await supabase
        .from('categories')
        .insert(categoriesToInsert)
        .select('id, name');

      if (catInsertError) {
        throw new Error(`Error creando categorías faltantes: ${catInsertError.message}`);
      }

      (insertedCats || []).forEach((c) => {
        categoryNameToId.set(c.name.trim().toLowerCase(), c.id);
      });
    }

    // ========================================================================
    // 2. RESOLVER O CREAR CLUBES
    // ========================================================================
    const uniqueClubNames = Array.from(
      new Set(athletes.map((a) => (a.club_name || '').trim()).filter(Boolean))
    );

    const { data: existingClubs, error: clubFetchError } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (clubFetchError) {
      throw new Error(`Error consultando clubes: ${clubFetchError.message}`);
    }

    const clubNameToId = new Map<string, string>();
    (existingClubs || []).forEach((cl) => {
      clubNameToId.set(cl.name.trim().toLowerCase(), cl.id);
    });

    const missingClubNames = uniqueClubNames.filter(
      (name) => !clubNameToId.has(name.toLowerCase())
    );

    if (missingClubNames.length > 0) {
      const clubsToInsert = missingClubNames.map((name) => ({
        organization_id: organizationId,
        name,
      }));

      const { data: insertedClubs, error: clubInsertError } = await supabase
        .from('clubs')
        .insert(clubsToInsert)
        .select('id, name');

      if (clubInsertError) {
        throw new Error(`Error creando clubes: ${clubInsertError.message}`);
      }

      (insertedClubs || []).forEach((cl) => {
        clubNameToId.set(cl.name.trim().toLowerCase(), cl.id);
      });
    }

    // ========================================================================
    // 3. UPSERT DE ATLETAS (POR ORGANIZATION_ID + RUT_DNI)
    // ========================================================================
    const sanitizedAthletes = athletes.map((a, idx) => {
      const rawName = (a.name || '').trim();
      const parts = rawName.split(/\s+/);
      const firstName = parts[0] || 'Atleta';
      const lastName = parts.slice(1).join(' ') || 'Sin Apellido';

      const rut =
        (a.rut_dni || '').trim().toUpperCase().replace(/[.\-\s]/g, '') ||
        `TEMP-${Date.now().toString().slice(-6)}-${idx + 1}`;

      const clubId = a.club_name
        ? clubNameToId.get(a.club_name.trim().toLowerCase()) || null
        : null;

      return {
        organization_id: organizationId,
        club_id: clubId,
        rut_dni: rut,
        first_name: firstName,
        last_name: lastName,
        birth_date: a.birth_date || (a.birth_year ? `${a.birth_year}-01-01` : '2008-01-01'),
        gender: a.gender || 'M',
        nationality: 'CHI',
      };
    });

    const { data: upsertedAthletes, error: athleteError } = await supabase
      .from('athletes')
      .upsert(sanitizedAthletes, { onConflict: 'organization_id,rut_dni' })
      .select('id, rut_dni');

    if (athleteError) {
      throw new Error(`Error insertando atletas: ${athleteError.message}`);
    }

    const rutToAthleteId = new Map<string, string>();
    (upsertedAthletes || []).forEach((ath) => {
      rutToAthleteId.set(ath.rut_dni, ath.id);
    });

    // ========================================================================
    // 4. REGISTRO EN TOURNAMENT_REGISTRATIONS (INSCRIPCIÓN EFECTIVA)
    // ========================================================================
    const registrationsToInsert = sanitizedAthletes.map((ath, idx) => {
      const original = athletes[idx];
      const athleteId = rutToAthleteId.get(ath.rut_dni);
      const categoryId = categoryNameToId.get(
        (original.category || 'Categoría Abierta').trim().toLowerCase()
      );

      if (!athleteId || !categoryId) {
        throw new Error(
          `Faltan identificadores para ${original.name} (Atleta: ${athleteId}, Categoría: ${categoryId})`
        );
      }

      return {
        organization_id: organizationId,
        tournament_id: tournamentId,
        category_id: categoryId,
        athlete_id: athleteId,
        club_id: ath.club_id,
        registered_weight: original.weight || null,
        weigh_in_status: 'PENDING' as const,
      };
    });

    const { error: regError } = await supabase
      .from('tournament_registrations')
      .upsert(registrationsToInsert, { onConflict: 'tournament_id,athlete_id' });

    if (regError) {
      throw new Error(`Error creando inscripciones: ${regError.message}`);
    }

    return {
      success: true,
      count: registrationsToInsert.length,
      message: `¡Inscripción exitosa! Se confirmaron y almacenaron ${registrationsToInsert.length} atletas en la base de datos.`,
    };
  } catch (err: any) {
    console.error('[confirmRegistrationsAction] Error:', err);
    return {
      success: false,
      count: 0,
      message: 'Ocurrió un error al procesar las inscripciones en la base de datos.',
      error: err?.message || 'Error desconocido del servidor.',
    };
  }
}
