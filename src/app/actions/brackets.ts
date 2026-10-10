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
 * Además, distribuye equitativamente las categorías entre los tatamis configurados
 * si aún no tienen un tatami asignado.
 */
export async function getTournamentCategoriesStatusAction(
  tournamentId: string = 'e0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; categories: CategoryBracketStatus[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Consultar el campeonato para conocer su cantidad de tatamis
    const { data: tourData } = await supabase
      .from('tournaments')
      .select('id, config')
      .eq('id', tournamentId)
      .maybeSingle();

    const tatamiCount = Number((tourData?.config as any)?.tatami_count) || 2;

    // 2. Consultar categorías del torneo
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, age_group, gender, assigned_tatami_number')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true });

    if (catErr) throw new Error(catErr.message);

    if (!categories || categories.length === 0) {
      return { success: true, categories: [] };
    }

    // 3. Distribución equitativa entre tatamis si no tienen tatami asignado
    for (let idx = 0; idx < categories.length; idx++) {
      const cat = categories[idx];
      if (!cat.assigned_tatami_number || cat.assigned_tatami_number <= 0) {
        const assignedTatami = (idx % tatamiCount) + 1;
        cat.assigned_tatami_number = assignedTatami;
        await supabase
          .from('categories')
          .update({ assigned_tatami_number: assignedTatami })
          .eq('id', cat.id);
      }
    }

    // 4. Consultar inscripciones con pesaje
    const { data: registrations, error: regErr } = await supabase
      .from('tournament_registrations')
      .select('id, category_id, weigh_in_status')
      .eq('tournament_id', tournamentId);

    if (regErr) throw new Error(regErr.message);

    // 5. Consultar si ya hay combates generados en este torneo
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
 * e inserta masivamente los combates generados en la base de datos Supabase
 * utilizando las columnas relacionales nativas (next_match_id, next_match_slot).
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

    const assignedTatami = category.assigned_tatami_number || tatamiNumber;

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

    // Mapear a la interfaz Competitor con su athlete_id real
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
      .eq('tatami_number', assignedTatami)
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
      tatami_number: assignedTatami,
      match_duration_seconds: category.match_duration_seconds || 240,
      start_match_number: startMatchNumber,
    });

    // 5. Borrar combates previos de esta categoría en este torneo
    await supabase
      .from('matches')
      .delete()
      .eq('category_id', categoryId)
      .eq('tournament_id', tournamentId);

    // 6. Inserción pura y limpia en PostgreSQL con columnas nativas
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id || organizationId,
      tournament_id: m.tournament_id || tournamentId,
      category_id: m.category_id || categoryId,
      tatami_number: m.tatami_number || assignedTatami,
      match_number: m.match_number,
      round: m.round,
      white_athlete_id: m.white_athlete_id || null,
      blue_athlete_id: m.blue_athlete_id || null,
      next_match_id: m.next_match_id || null,
      next_match_slot: m.next_match_slot || null,
      status: m.status,
      white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
      blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
      current_match_time_seconds: 0,
      is_golden_score: false,
    }));

    const { error: insertErr } = await supabase.from('matches').insert(matchesToInsert);

    if (insertErr) {
      console.error('[generateCategoryMatchesAction] Error insertando en Supabase:', insertErr.message);
      throw new Error(`Fallo guardando combates en la base de datos: ${insertErr.message}`);
    }

    return {
      success: true,
      result: bracketResult,
      message: `¡Llave generada exitosamente en Tatami #${assignedTatami}! Se programaron ${bracketResult.total_matches} combates (${bracketResult.summary.description}).`,
    };
  } catch (err: any) {
    console.error('[generateCategoryMatchesAction] Error:', err);
    return {
      success: false,
      message: err.message || 'Fallo al ejecutar el motor de sorteo.',
      error: err.message,
    };
  }
}

/**
 * Reconstruye el BracketResult guardado en Supabase para una categoría específica
 * consumiendo directamente las columnas relacionales next_match_id y next_match_slot.
 */
export async function getCategoryBracketAction(
  categoryId: string,
  tournamentId: string
): Promise<{ success: boolean; result?: BracketResult; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: category } = await supabase
      .from('categories')
      .select('id, name, assigned_tatami_number')
      .eq('id', categoryId)
      .maybeSingle();

    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        organization_id,
        tournament_id,
        category_id,
        tatami_number,
        match_number,
        round,
        status,
        white_athlete_id,
        blue_athlete_id,
        next_match_id,
        next_match_slot,
        winner_id,
        white_score,
        blue_score,
        current_match_time_seconds,
        is_golden_score,
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
      .eq('category_id', categoryId)
      .order('match_number', { ascending: true });

    if (error || !matches || matches.length === 0) {
      return { success: false, error: 'No hay combates generados para esta categoría.' };
    }

    // Determinar el tipo de llave
    const firstRound = matches[0].round || '';
    let bracketType: BracketResult['bracket_type'] = 'SINGLE_ELIMINATION';
    if (firstRound.startsWith('BEST_OF_3')) {
      bracketType = 'BEST_OF_3';
    } else if (firstRound.startsWith('RR_')) {
      bracketType = 'ROUND_ROBIN';
    }

    const mappedMatches: GeneratedMatch[] = matches.map((m: any) => {
      const whiteAth = Array.isArray(m.white_athlete) ? m.white_athlete[0] : m.white_athlete;
      const blueAth = Array.isArray(m.blue_athlete) ? m.blue_athlete[0] : m.blue_athlete;

      const whiteName = whiteAth
        ? `${whiteAth.first_name || ''} ${whiteAth.last_name || ''}`.trim()
        : 'Por definir';
      const blueName = blueAth
        ? `${blueAth.first_name || ''} ${blueAth.last_name || ''}`.trim()
        : 'Por definir';

      const whiteClub =
        whiteAth?.club?.name ||
        (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente');
      const blueClub =
        blueAth?.club?.name ||
        (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente');

      return {
        id: m.id,
        organization_id: m.organization_id,
        tournament_id: m.tournament_id,
        category_id: m.category_id,
        tatami_number: m.tatami_number,
        match_number: m.match_number,
        round: m.round,
        round_name: m.round,
        white_athlete_id: m.white_athlete_id,
        blue_athlete_id: m.blue_athlete_id,
        white_athlete_name: whiteName,
        blue_athlete_name: blueName,
        white_club_name: whiteClub,
        blue_club_name: blueClub,
        winner_id: m.winner_id,
        status: m.status,
        white_score: {
          ippon: m.white_score?.ippon || 0,
          wazaari: m.white_score?.wazaari || 0,
          yuko: m.white_score?.yuko || 0,
          shido: m.white_score?.shido || 0,
        },
        blue_score: {
          ippon: m.blue_score?.ippon || 0,
          wazaari: m.blue_score?.wazaari || 0,
          yuko: m.blue_score?.yuko || 0,
          shido: m.blue_score?.shido || 0,
        },
        current_match_time_seconds: m.current_match_time_seconds || 0,
        is_golden_score: m.is_golden_score || false,
        next_match_id: m.next_match_id || null,
        next_match_slot: m.next_match_slot || null,
      };
    });

    const result: BracketResult = {
      bracket_type: bracketType,
      competitor_count: mappedMatches.length,
      total_matches: mappedMatches.length,
      matches: mappedMatches,
      summary: {
        description:
          bracketType === 'BEST_OF_3'
            ? 'Modalidad al Mejor de 3 (Best of 3)'
            : bracketType === 'ROUND_ROBIN'
            ? 'Todos contra Todos (Round Robin Berger)'
            : 'Eliminación Simple IJF',
        rounds_count: 1,
        byes_count: 0,
      },
    };

    return { success: true, result };
  } catch (err: any) {
    console.error('[getCategoryBracketAction] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene los combates asignados a un Tatami específico ordenados por cola cronológica.
 * Si no se provee tournamentId o es default, resuelve automáticamente el campeonato activo.
 */
export async function getTatamiQueueMatchesAction(
  tatamiNumber: number,
  tournamentId?: string
): Promise<{ success: boolean; matches: any[]; error?: string }> {
  try {
    const supabase = createAdminClient();

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
      } else {
        targetTourId = 'e0000000-0000-0000-0000-000000000001';
      }
    }

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
        next_match_id,
        next_match_slot,
        winner_id,
        started_at,
        ended_at,
        white_score,
        blue_score,
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
      .eq('tournament_id', targetTourId)
      .eq('tatami_number', tatamiNumber)
      .order('match_number', { ascending: true });

    if (error) {
      console.warn('[getTatamiQueueMatchesAction] Error en consulta:', error.message);
      return { success: false, matches: [], error: error.message };
    }

    // Normalizar nombres y clubes usando el join relacional limpio
    const normalizedMatches = (data || []).map((m: any) => {
      const whiteAth = Array.isArray(m.white_athlete) ? m.white_athlete[0] : m.white_athlete;
      const blueAth = Array.isArray(m.blue_athlete) ? m.blue_athlete[0] : m.blue_athlete;

      const whiteName = whiteAth
        ? `${whiteAth.first_name || ''} ${whiteAth.last_name || ''}`.trim()
        : 'Por definir';
      const blueName = blueAth
        ? `${blueAth.first_name || ''} ${blueAth.last_name || ''}`.trim()
        : 'Por definir';

      return {
        ...m,
        white_athlete_name: whiteName,
        white_club_name: whiteAth?.club?.name || (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente'),
        blue_athlete_name: blueName,
        blue_club_name: blueAth?.club?.name || (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente'),
        round_name: m.round,
      };
    });

    return { success: true, matches: normalizedMatches };
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
        white_athlete_id,
        blue_athlete_id,
        next_match_id,
        next_match_slot,
        winner_id,
        white_score,
        blue_score,
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
    const whiteAth = Array.isArray(rawData?.white_athlete) ? rawData.white_athlete[0] : rawData?.white_athlete;
    const blueAth = Array.isArray(rawData?.blue_athlete) ? rawData.blue_athlete[0] : rawData?.blue_athlete;

    const whiteName = whiteAth
      ? `${whiteAth.first_name || ''} ${whiteAth.last_name || ''}`.trim()
      : 'Atleta Blanco';
    const blueName = blueAth
      ? `${blueAth.first_name || ''} ${blueAth.last_name || ''}`.trim()
      : 'Atleta Azul';

    const categoryObj = Array.isArray(rawData?.category) ? rawData.category[0] : rawData?.category;

    const matchPayload = {
      id: data.id,
      tournament_id: data.tournament_id,
      category_id: data.category_id,
      category_name: categoryObj?.name || 'Categoría Oficial',
      tatami_number: data.tatami_number,
      match_number: data.match_number,
      white_athlete_name: whiteName,
      white_club_name: whiteAth?.club?.name || (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente'),
      blue_athlete_name: blueName,
      blue_club_name: blueAth?.club?.name || (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente'),
      match_duration_seconds: categoryObj?.match_duration_seconds || 240,
      status: data.status || 'SCHEDULED',
      current_time_seconds: data.current_match_time_seconds || 0,
      next_match_id: data.next_match_id || null,
      next_match_slot: data.next_match_slot || null,
      updated_at: new Date().toISOString(),
    };

    return { success: true, match: matchPayload };
  } catch (err: any) {
    console.error('[getMatchByIdAction] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Guarda las modificaciones manuales que el Director realizó en el sorteo (BracketViewer)
 * sincronizándolas en la base de datos Supabase con sus columnas nativas.
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

    // 1. Eliminar combates anteriores de esta categoría en este torneo
    await supabase
      .from('matches')
      .delete()
      .eq('category_id', categoryId)
      .eq('tournament_id', tournamentId);

    // 2. Inserción pura en PostgreSQL
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      tournament_id: m.tournament_id || tournamentId,
      category_id: m.category_id || categoryId,
      tatami_number: m.tatami_number,
      match_number: m.match_number,
      round: m.round,
      white_athlete_id: m.white_athlete_id || null,
      blue_athlete_id: m.blue_athlete_id || null,
      next_match_id: m.next_match_id || null,
      next_match_slot: m.next_match_slot || null,
      status: m.status,
      white_score: m.white_score || { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
      blue_score: m.blue_score || { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
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
