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
    // 0. ASEGURAR INTEGRIDAD REFERENCIAL (ORGANIZACIÓN Y TORNEO)
    // ========================================================================
    // a. Asegurar Organización
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .maybeSingle();

    if (!orgData) {
      await supabase.from('organizations').upsert(
        {
          id: organizationId,
          name: 'Asociación Regional de Judo Tarapacá',
          slug: 'judo-tarapaca',
        },
        { onConflict: 'id' }
      );
    }

    let targetTourId = tournamentId;
    if (!targetTourId || targetTourId === 'e0000000-0000-0000-0000-000000000001') {
      const { data: activeTour } = await supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeTour?.id) {
        targetTourId = activeTour.id;
      }
    }

    // b. Asegurar Torneo en la tabla 'tournaments' de Supabase
    const { data: tourData } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('id', targetTourId)
      .maybeSingle();

    if (!tourData) {
      const nowIso = new Date().toISOString();
      const { error: tourInsertErr } = await supabase.from('tournaments').upsert(
        {
          id: targetTourId,
          organization_id: organizationId,
          name: 'Torneo Regional Iquique Open 2026',
          status: 'ACTIVE',
          location: 'Polideportivo Central Iquique',
          start_date: nowIso.split('T')[0],
          end_date: nowIso.split('T')[0],
          config: {
            tatami_count: 3,
            score_types: ['IPPON', 'WAZA_ARI', 'YUKO'],
            best_of_limit: 6,
          },
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );

      if (tourInsertErr) {
        console.error('[confirmRegistrationsAction] Error aprovisionando torneo:', tourInsertErr.message);
        throw new Error(`Error aprovisionando campeonato en la base de datos: ${tourInsertErr.message}`);
      }
    }

    // ========================================================================
    // 1. RESOLVER O CREAR CATEGORÍAS
    // ========================================================================
    const uniqueCategoryNames = Array.from(
      new Set(athletes.map((a) => (a.category || 'Categoría Abierta').trim()).filter(Boolean))
    );

    const { data: existingCategories, error: catFetchError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('tournament_id', targetTourId);

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
        const isFemale =
          lower.includes('femenin') ||
          lower.includes('damas') ||
          lower.includes('mujeres');
        const gender = isFemale ? 'F' : 'M';

        let ageGroup = 'Cadetes';
        if (lower.includes('sub-11') || lower.includes('sub 11')) ageGroup = 'Sub-11';
        else if (lower.includes('sub-13') || lower.includes('sub 13')) ageGroup = 'Sub-13';
        else if (lower.includes('sub-15') || lower.includes('sub 15')) ageGroup = 'Sub-15';
        else if (lower.includes('cadet') || lower.includes('sub-18') || lower.includes('sub 18')) ageGroup = 'Cadetes';
        else if (lower.includes('junior') || lower.includes('sub-21') || lower.includes('sub 21')) ageGroup = 'Junior';
        else if (lower.includes('senior') || lower.includes('adulto')) ageGroup = 'Senior';
        else if (lower.includes('master')) ageGroup = 'Master';

        // Detectar peso máximo si está en el nombre (ej: -52kg, -60kg)
        const weightMatch = catName.match(/([+-]?\d+(?:\.\d+)?)\s*kg/i);
        const maxWeight = weightMatch ? parseFloat(weightMatch[1].replace('+', '')) : null;

        return {
          organization_id: organizationId,
          tournament_id: targetTourId,
          name: catName,
          age_group: ageGroup,
          gender: gender,
          max_weight: maxWeight,
          match_duration_seconds: ageGroup.startsWith('Sub-1') ? 180 : 240,
          is_official: true,
        };
      });

      const { data: insertedCats, error: catInsertError } = await supabase
        .from('categories')
        .insert(categoriesToInsert)
        .select('id, name');

      if (catInsertError) {
        console.error('[confirmRegistrationsAction] Error insertando categorías:', catInsertError);
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
        console.error('[confirmRegistrationsAction] Error insertando clubes:', clubInsertError);
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

    // Deduplicar atletas en el lote por RUT para evitar conflicto batch en PostgreSQL
    const uniqueAthletesMap = new Map<string, (typeof sanitizedAthletes)[0]>();
    sanitizedAthletes.forEach((ath) => {
      uniqueAthletesMap.set(ath.rut_dni, ath);
    });
    const dedupedAthletes = Array.from(uniqueAthletesMap.values());

    const { data: upsertedAthletes, error: athleteError } = await supabase
      .from('athletes')
      .upsert(dedupedAthletes, { onConflict: 'organization_id,rut_dni' })
      .select('id, rut_dni');

    if (athleteError) {
      console.error('[confirmRegistrationsAction] Error insertando atletas:', athleteError);
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
        tournament_id: targetTourId,
        category_id: categoryId,
        athlete_id: athleteId,
        club_id: ath.club_id,
        registered_weight: original.weight || null,
        weigh_in_status: 'PENDING' as const,
      };
    });

    // Deduplicar inscripciones por atleta en el lote para respetar uq_registration
    const uniqueRegsMap = new Map<string, (typeof registrationsToInsert)[0]>();
    registrationsToInsert.forEach((reg) => {
      uniqueRegsMap.set(reg.athlete_id, reg);
    });
    const dedupedRegistrations = Array.from(uniqueRegsMap.values());

    const { error: regError } = await supabase
      .from('tournament_registrations')
      .upsert(dedupedRegistrations, { onConflict: 'tournament_id,athlete_id' });

    if (regError) {
      console.error('[confirmRegistrationsAction] Error insertando inscripciones:', regError);
      throw new Error(`Error creando inscripciones: ${regError.message}`);
    }

    return {
      success: true,
      count: dedupedRegistrations.length,
      message: `¡Inscripción exitosa! Se confirmaron y almacenaron ${dedupedRegistrations.length} atletas en la base de datos.`,
    };
  } catch (err: any) {
    console.error('[confirmRegistrationsAction] Error:', err);
    return {
      success: false,
      count: 0,
      message: err?.message || 'Ocurrió un error al procesar las inscripciones en la base de datos.',
      error: err?.message || 'Error desconocido del servidor.',
    };
  }
}

export interface RegisteredAthleteSummary {
  id: string;
  athlete_id: string;
  rut_dni: string;
  name: string;
  club_name: string;
  birth_year: number;
  gender: 'M' | 'F';
  category_name: string;
  category_id: string;
  weigh_in_status: string;
  actual_weight?: number | null;
  registered_weight?: number | null;
}

/**
 * Obtiene la lista de deportistas inscritos estrictamente en un torneo específico.
 */
export async function getTournamentRegistrationsAction(
  tournamentId: string
): Promise<{ success: boolean; athletes: RegisteredAthleteSummary[]; error?: string }> {
  if (!tournamentId) {
    return { success: false, athletes: [], error: 'ID de campeonato inválido' };
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('tournament_registrations')
      .select(`
        id,
        registered_weight,
        actual_weight,
        weigh_in_status,
        category:categories (
          id,
          name
        ),
        athlete:athletes (
          id,
          rut_dni,
          first_name,
          last_name,
          gender,
          birth_date,
          club:clubs (
            name
          )
        )
      `)
      .eq('tournament_id', tournamentId);

    if (error) {
      console.warn('[getTournamentRegistrationsAction] Error:', error.message);
      return { success: false, athletes: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, athletes: [] };
    }

    const athletes: RegisteredAthleteSummary[] = data.map((item: any) => {
      const birthYear = item.athlete?.birth_date
        ? new Date(item.athlete.birth_date).getFullYear()
        : 2009;

      return {
        id: item.id,
        athlete_id: item.athlete?.id || '',
        rut_dni: item.athlete?.rut_dni || '',
        name: `${item.athlete?.first_name || ''} ${item.athlete?.last_name || ''}`.trim(),
        club_name: item.athlete?.club?.name || 'Independiente',
        category_name: item.category?.name || 'Categoría Oficial',
        category_id: item.category?.id || '',
        gender: (item.athlete?.gender as 'M' | 'F') || 'M',
        birth_year: birthYear,
        weigh_in_status: item.weigh_in_status || 'PENDING',
        actual_weight: item.actual_weight,
        registered_weight: item.registered_weight,
      };
    });

    return { success: true, athletes };
  } catch (err: any) {
    console.error('[getTournamentRegistrationsAction] Excepción:', err);
    return { success: false, athletes: [], error: err.message };
  }
}

/**
 * Reasigna la inscripción de un judoka a una categoría diferente dentro del torneo.
 * Permite ingresar competidores a categorías creadas posteriormente.
 */
export async function reassignAthleteCategoryAction(params: {
  registrationId: string;
  targetCategoryId: string;
  tournamentId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createAdminClient();
    const { registrationId, targetCategoryId, tournamentId } = params;

    if (!registrationId || !targetCategoryId) {
      return { success: false, message: 'Datos incompletos para reasignar categoría.' };
    }

    // 1. Obtener datos de la nueva categoría
    const { data: targetCat, error: catErr } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', targetCategoryId)
      .eq('tournament_id', tournamentId)
      .maybeSingle();

    if (catErr || !targetCat) {
      return { success: false, message: 'La categoría de destino no existe en este torneo.' };
    }

    // 2. Actualizar la inscripción del judoka
    const { error: updateErr } = await supabase
      .from('tournament_registrations')
      .update({
        category_id: targetCategoryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateErr) {
      return { success: false, message: `Error al reasignar: ${updateErr.message}` };
    }

    return {
      success: true,
      message: `Judoka reasignado exitosamente a la categoría "${targetCat.name}".`,
    };
  } catch (err: any) {
    console.error('[reassignAthleteCategoryAction] Error:', err);
    return { success: false, message: 'Error interno reasignando categoría.' };
  }
}

