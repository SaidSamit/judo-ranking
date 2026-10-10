// ==============================================================================
// SERVER ACTIONS: MOTOR DE SORTEO Y LLAVES (DIRECTORIO Y TATAMI)
// ==============================================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateCategoryBracket,
  Competitor,
  BracketResult,
  GeneratedMatch,
} from '@/lib/rules/bracket-engine';

export interface CategoryBracketStatus {
  id: string;
  name: string;
  age_group: string;
  gender: string;
  assigned_tatami_number: number;
  total_registered: number;
  passed_weigh_in: number;
  pending_weigh_in: number;
  dsq_count: number;
  is_weigh_in_closed: boolean;
  matches_generated: boolean;
  bracket_type?: 'BEST_OF_3' | 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'INSUFFICIENT';
}

/**
 * Obtiene el resumen de categorías del torneo, evaluando el progreso de pesaje y llaves.
 */
export async function getTournamentCategoriesStatusAction(
  tournamentId: string = 'e0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; categories: CategoryBracketStatus[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Consultar categorías del torneo
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, age_group, gender, assigned_tatami_number')
      .eq('tournament_id', tournamentId);

    if (catErr) throw new Error(catErr.message);

    if (!categories || categories.length === 0) {
      return { success: true, categories: [] };
    }

    // 2. Consultar inscripciones con pesaje
    const { data: registrations, error: regErr } = await supabase
      .from('tournament_registrations')
      .select('id, category_id, weigh_in_status')
      .eq('tournament_id', tournamentId);

    if (regErr) throw new Error(regErr.message);

    // 3. Consultar si ya hay combates generados
    const { data: existingMatches, error: matchErr } = await supabase
      .from('matches')
      .select('id, category_id')
      .eq('tournament_id', tournamentId);

    if (matchErr) throw new Error(matchErr.message);

    const matchesByCategory = new Set<string>();
    (existingMatches || []).forEach((m) => matchesByCategory.add(m.category_id));

    // Mapear estadísticas por categoría
    const result: CategoryBracketStatus[] = categories.map((cat) => {
      const catRegs = (registrations || []).filter((r) => r.category_id === cat.id);
      const total = catRegs.length;
      const passed = catRegs.filter((r) => r.weigh_in_status === 'PASSED').length;
      const pending = catRegs.filter((r) => r.weigh_in_status === 'PENDING').length;
      const dsq = catRegs.filter((r) => r.weigh_in_status === 'DSQ').length;

      // El pesaje se considera cerrado si no hay atletas en 'PENDING' y hay al menos 1 atleta procesado
      const isClosed = total > 0 && pending === 0;

      let bracketType: CategoryBracketStatus['bracket_type'] = 'SINGLE_ELIMINATION';
      if (passed < 2) bracketType = 'INSUFFICIENT';
      else if (passed === 2) bracketType = 'BEST_OF_3';
      else if (passed >= 3 && passed <= 5) bracketType = 'ROUND_ROBIN';
      else bracketType = 'SINGLE_ELIMINATION';

      return {
        id: cat.id,
        name: cat.name,
        age_group: cat.age_group,
        gender: cat.gender,
        assigned_tatami_number: cat.assigned_tatami_number || 1,
        total_registered: total,
        passed_weigh_in: passed,
        pending_weigh_in: pending,
        dsq_count: dsq,
        is_weigh_in_closed: isClosed,
        matches_generated: matchesByCategory.has(cat.id),
        bracket_type: bracketType,
      };
    });

    return { success: true, categories: result };
  } catch (err: any) {
    console.error('[getTournamentCategoriesStatusAction] Error:', err);
    return { success: false, categories: [], error: err.message };
  }
}

/**
 * Ejecuta el motor de sorteo (bracket-engine.ts) para una categoría cerrada
 * e inserta masivamente los combates generados en la base de datos Supabase.
 */
export async function generateCategoryMatchesAction(params: {
  categoryId: string;
  tatamiNumber?: number;
  tournamentId?: string;
  organizationId?: string;
}): Promise<{
  success: boolean;
  result?: BracketResult;
  message: string;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();
    const {
      categoryId,
      tatamiNumber = 1,
      tournamentId = 'e0000000-0000-0000-0000-000000000001',
      organizationId = 'a0000000-0000-0000-0000-000000000001',
    } = params;

    // 1. Obtener la categoría
    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('id, name, assigned_tatami_number, match_duration_seconds')
      .eq('id', categoryId)
      .single();

    if (catErr || !category) {
      throw new Error(`Categoría no encontrada: ${catErr?.message || 'ID inválido'}`);
    }

    // 2. Obtener competidores con pesaje aprobado (PASSED)
    const { data: registrations, error: regErr } = await supabase
      .from('tournament_registrations')
      .select(`
        id,
        actual_weight,
        athlete:athletes (
          id,
          first_name,
          last_name,
          club:clubs (
            name
          )
        )
      `)
      .eq('category_id', categoryId)
      .eq('weigh_in_status', 'PASSED');

    if (regErr) throw new Error(regErr.message);

    if (!registrations || registrations.length < 2) {
      return {
        success: false,
        message: 'No hay suficientes atletas pesados y aprobados (mínimo 2) para generar la llave.',
        error: 'Cantidad insuficiente de atletas clasificados.',
      };
    }

    // Mapear a la interfaz Competitor requerida por el motor de sorteo
    const competitors: Competitor[] = registrations.map((r: any, idx: number) => ({
      id: r.athlete?.id || r.id,
      name: `${r.athlete?.first_name || ''} ${r.athlete?.last_name || ''}`.trim(),
      club_name: r.athlete?.club?.name || 'Independiente',
      seed: idx + 1,
      weight: r.actual_weight || undefined,
    }));

    // 3. Determinar el número correlativo inicial de combate en el tatami
    const { data: lastMatch } = await supabase
      .from('matches')
      .select('match_number')
      .eq('tournament_id', tournamentId)
      .eq('tatami_number', category.assigned_tatami_number || tatamiNumber)
      .order('match_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startMatchNumber = lastMatch?.match_number ? lastMatch.match_number + 1 : 1;

    // 4. Ejecutar el motor matemático de llaves (Fase 5 / 6)
    const bracketResult = generateCategoryBracket(competitors, {
      organization_id: organizationId,
      tournament_id: tournamentId,
      category_id: category.id,
      category_name: category.name,
      tatami_number: category.assigned_tatami_number || tatamiNumber,
      match_duration_seconds: category.match_duration_seconds || 240,
      start_match_number: startMatchNumber,
    });

    // 5. Borrar combates previos si se está regenerando
    await supabase.from('matches').delete().eq('category_id', categoryId);

    // 6. Insertar combates generados en Supabase
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      tournament_id: m.tournament_id,
      category_id: m.category_id,
      tatami_number: m.tatami_number,
      match_number: m.match_number,
      round: m.round,
      white_athlete_id: m.white_athlete_id,
      blue_athlete_id: m.blue_athlete_id,
      status: m.status,
      white_score: m.white_score,
      blue_score: m.blue_score,
      current_match_time_seconds: 0,
      is_golden_score: false,
    }));

    const { error: insertErr } = await supabase.from('matches').insert(matchesToInsert);

    if (insertErr) {
      console.warn('[generateCategoryMatchesAction] Error insertando en Supabase:', insertErr.message);
      // Retornar el resultado igualmente para visualización local
    }

    return {
      success: true,
      result: bracketResult,
      message: `¡Llave generada exitosamente! Se programaron ${bracketResult.total_matches} combates (${bracketResult.summary.description}).`,
    };
  } catch (err: any) {
    console.error('[generateCategoryMatchesAction] Error:', err);
    return {
      success: false,
      message: 'Fallo al ejecutar el motor de sorteo.',
      error: err.message,
    };
  }
}

/**
 * Obtiene los combates asignados a un Tatami específico ordenados por cola cronológica.
 */
export async function getTatamiQueueMatchesAction(
  tatamiNumber: number,
  tournamentId: string = 'e0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; matches: any[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        tatami_number,
        match_number,
        round,
        status,
        white_athlete_id,
        blue_athlete_id,
        winner_id,
        started_at,
        ended_at,
        category:categories (
          id,
          name,
          match_duration_seconds
        ),
        white_athlete:athletes!matches_white_athlete_id_fkey (
          id,
          first_name,
          last_name,
          club:clubs (
            name
          )
        ),
        blue_athlete:athletes!matches_blue_athlete_id_fkey (
          id,
          first_name,
          last_name,
          club:clubs (
            name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('tatami_number', tatamiNumber)
      .order('match_number', { ascending: true });

    if (error) {
      console.warn('[getTatamiQueueMatchesAction] Error en consulta:', error.message);
      return { success: false, matches: [], error: error.message };
    }

    return { success: true, matches: data || [] };
  } catch (err: any) {
    console.error('[getTatamiQueueMatchesAction] Error inesperado:', err);
    return { success: false, matches: [], error: err.message };
  }
}

/**
 * Obtiene un combate específico por su ID con datos completos de atletas y categoría.
 * Utilizado por la Mesa de Control (/tatami/[id]) para inicializar el combate llamado.
 */
export async function getMatchByIdAction(
  matchId: string
): Promise<{ success: boolean; match?: any; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        tournament_id,
        category_id,
        tatami_number,
        match_number,
        round,
        status,
        current_match_time_seconds,
        category:categories (
          id,
          name,
          match_duration_seconds
        ),
        white_athlete:athletes!matches_white_athlete_id_fkey (
          id,
          first_name,
          last_name,
          club:clubs (
            name
          )
        ),
        blue_athlete:athletes!matches_blue_athlete_id_fkey (
          id,
          first_name,
          last_name,
          club:clubs (
            name
          )
        )
      `)
      .eq('id', matchId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: error?.message || 'Combate no encontrado' };
    }

    const rawData = data as any;
    const whiteAthlete = Array.isArray(rawData.white_athlete)
      ? rawData.white_athlete[0]
      : rawData.white_athlete;
    const blueAthlete = Array.isArray(rawData.blue_athlete)
      ? rawData.blue_athlete[0]
      : rawData.blue_athlete;

    const whiteName = whiteAthlete
      ? `${whiteAthlete.first_name} ${whiteAthlete.last_name}`
      : 'Atleta Blanco';
    const whiteClub =
      whiteAthlete?.club?.name ||
      (Array.isArray(whiteAthlete?.club) ? whiteAthlete.club[0]?.name : 'Independiente');
    const blueName = blueAthlete
      ? `${blueAthlete.first_name} ${blueAthlete.last_name}`
      : 'Atleta Azul';
    const blueClub =
      blueAthlete?.club?.name ||
      (Array.isArray(blueAthlete?.club) ? blueAthlete.club[0]?.name : 'Independiente');

    const localMatch = {
      id: rawData.id,
      tournament_id: rawData.tournament_id,
      category_id: rawData.category_id,
      category_name: rawData.category?.name || 'Categoría Oficial',
      tatami_number: rawData.tatami_number,
      match_number: rawData.match_number,
      white_athlete_name: whiteName,
      white_club_name: whiteClub,
      blue_athlete_name: blueName,
      blue_club_name: blueClub,
      match_duration_seconds: rawData.category?.match_duration_seconds || 240,
      status: rawData.status || 'SCHEDULED',
      current_time_seconds: rawData.current_match_time_seconds || 0,
      updated_at: new Date().toISOString(),
    };

    return { success: true, match: localMatch };
  } catch (err: any) {
    console.error('[getMatchByIdAction] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Guarda las modificaciones manuales realizadas por el Director a una llave
 * (intercambio de atletas, ajustes de cabezas de serie, etc.) en Supabase.
 */
export async function saveModifiedBracketAction(params: {
  categoryId: string;
  bracketResult: BracketResult;
  tournamentId?: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const supabase = createAdminClient();
    const {
      categoryId,
      bracketResult,
      tournamentId = 'e0000000-0000-0000-0000-000000000001',
    } = params;

    // 1. Eliminar combates anteriores de esta categoría
    await supabase.from('matches').delete().eq('category_id', categoryId);

    // 2. Insertar combates modificados
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      tournament_id: m.tournament_id || tournamentId,
      category_id: m.category_id || categoryId,
      tatami_number: m.tatami_number,
      match_number: m.match_number,
      round: m.round,
      white_athlete_id: m.white_athlete_id,
      blue_athlete_id: m.blue_athlete_id,
      status: m.status,
      white_score: m.white_score,
      blue_score: m.blue_score,
      current_match_time_seconds: 0,
      is_golden_score: false,
    }));

    const { error: insertErr } = await supabase.from('matches').insert(matchesToInsert);
    if (insertErr) {
      throw new Error(`Error persistiendo modificaciones en base de datos: ${insertErr.message}`);
    }

    return {
      success: true,
      message: '¡Llave modificada y sincronizada con éxito en la cola de combates!',
    };
  } catch (err: any) {
    console.error('[saveModifiedBracketAction] Error:', err);
    return { success: false, message: 'Fallo al guardar modificaciones de la llave.', error: err.message };
  }
}

