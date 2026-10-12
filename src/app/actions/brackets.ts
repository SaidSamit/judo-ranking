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
  sequenceTatamiMatches,
  estimateCategoryMatchesCount,
  formatRoundName,
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
  tournamentId?: string
): Promise<{ success: boolean; categories: CategoryBracketStatus[]; error?: string }> {
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

      targetTourId = activeTour?.id || 'e0000000-0000-0000-0000-000000000001';
    }

    // 1. Consultar el campeonato para conocer su cantidad de tatamis
    const { data: tourData } = await supabase
      .from('tournaments')
      .select('id, config')
      .eq('id', targetTourId)
      .maybeSingle();

    const tatamiCount = Number((tourData?.config as any)?.tatami_count) || 2;

    // 2. Consultar categorías del torneo
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, age_group, gender, assigned_tatami_number')
      .eq('tournament_id', targetTourId)
      .order('name', { ascending: true });

    if (catErr) throw new Error(catErr.message);

    if (!categories || categories.length === 0) {
      return { success: true, categories: [] };
    }

    // 3. Consultar inscripciones para calcular carga real y balancear equitativamente
    const { data: registrations, error: regErr } = await supabase
      .from('tournament_registrations')
      .select('id, category_id, weigh_in_status')
      .eq('tournament_id', targetTourId);

    if (regErr) throw new Error(regErr.message);

    // Calcular atletas por categoría para estimar el volumen de combates
    const athleteCountByCat = new Map<string, number>();
    (registrations || []).forEach((r) => {
      athleteCountByCat.set(r.category_id, (athleteCountByCat.get(r.category_id) || 0) + 1);
    });

    // Carga acumulada por tatami
    const tatamiLoad = new Map<number, number>();
    for (let t = 1; t <= tatamiCount; t++) {
      tatamiLoad.set(t, 0);
    }

    // Contabilizar la carga de categorías que ya tienen tatami asignado válido
    categories.forEach((cat) => {
      if (cat.assigned_tatami_number && cat.assigned_tatami_number >= 1 && cat.assigned_tatami_number <= tatamiCount) {
        const count = athleteCountByCat.get(cat.id) || 4;
        const est = estimateCategoryMatchesCount(count);
        tatamiLoad.set(cat.assigned_tatami_number, (tatamiLoad.get(cat.assigned_tatami_number) || 0) + est);
      }
    });

    // Categorías sin asignar: ordenarlas por carga estimada descendente (Algoritmo LPT)
    const unassignedCats = categories.filter(
      (c) => !c.assigned_tatami_number || c.assigned_tatami_number <= 0 || c.assigned_tatami_number > tatamiCount
    );
    unassignedCats.sort((a, b) => {
      const loadA = estimateCategoryMatchesCount(athleteCountByCat.get(a.id) || 4);
      const loadB = estimateCategoryMatchesCount(athleteCountByCat.get(b.id) || 4);
      return loadB - loadA;
    });

    for (const cat of unassignedCats) {
      let bestTatami = 1;
      let minLoad = Infinity;
      for (let t = 1; t <= tatamiCount; t++) {
        const currentLoad = tatamiLoad.get(t) || 0;
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          bestTatami = t;
        }
      }

      cat.assigned_tatami_number = bestTatami;
      const catLoad = estimateCategoryMatchesCount(athleteCountByCat.get(cat.id) || 4);
      tatamiLoad.set(bestTatami, minLoad + catLoad);

      await supabase
        .from('categories')
        .update({ assigned_tatami_number: bestTatami })
        .eq('id', cat.id);
    }

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

    // 1. Obtener la categoría y su contexto relacional
    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('id, tournament_id, organization_id, name, assigned_tatami_number, match_duration_seconds')
      .eq('id', categoryId)
      .single();

    if (catErr || !category) {
      throw new Error(`Categoría no encontrada: ${catErr?.message || 'ID inválido'}`);
    }

    const actualTourId = category.tournament_id || tournamentId;
    const actualOrgId = category.organization_id || organizationId;
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
      .eq('tournament_id', actualTourId)
      .eq('tatami_number', assignedTatami)
      .order('match_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startMatchNumber = lastMatch?.match_number ? lastMatch.match_number + 1 : 1;

    // 4. Ejecutar el motor matemático de llaves (Fase 5 / 6)
    const bracketResult = generateCategoryBracket(competitors, {
      organization_id: actualOrgId,
      tournament_id: actualTourId,
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
      .eq('tournament_id', actualTourId);

    // 6. Inserción pura y limpia en PostgreSQL con columnas nativas
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id || actualOrgId,
      tournament_id: m.tournament_id || actualTourId,
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

    // Re-secuenciar toda la cola del tatami aplicando la regla de descanso IJF
    await resequenceTatamiMatchesAction(actualTourId, assignedTatami);

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
        round_name: formatRoundName(m.round),
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
      .neq('status', 'CANCELLED')
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
        round_name: formatRoundName(m.round),
      };
    });

    return { success: true, matches: normalizedMatches };
  } catch (err: any) {
    console.error('[getTatamiQueueMatchesAction] Error inesperado:', err);
    return { success: false, matches: [], error: err.message };
  }
}

export interface MultiTatamiMatch {
  id: string;
  match_number: number;
  tatami_number: number;
  category_name: string;
  round_name: string;
  white_athlete_name: string;
  white_club_name: string;
  blue_athlete_name: string;
  blue_club_name: string;
  status: 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'PENDING' | 'CANCELLED';
  matchesUntilStart: number; // 0 = en curso ahora, 1 = siguiente combate, 2 = en 2 combates...
}

export interface TatamiColumn {
  tatamiNumber: number;
  activeMatch: MultiTatamiMatch | null;
  upcomingMatches: MultiTatamiMatch[];
  finishedMatches: MultiTatamiMatch[];
  totalMatches: number;
}

/**
 * Obtiene la cola de combates en cascada de TODOS los tatamis en paralelo.
 * Agrupa los combates por tatami y calcula en cuántos combates más se disputará cada uno.
 */
export async function getAllTatamisQueueAction(
  tournamentId?: string
): Promise<{
  success: boolean;
  tournamentId: string;
  tournamentName: string;
  columns: TatamiColumn[];
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    let targetTourId = tournamentId;
    let tourName = 'Campeonato Oficial';
    let configTatamiCount = 2;

    if (!targetTourId) {
      const { data: activeTour } = await supabase
        .from('tournaments')
        .select('id, name, config')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeTour) {
        targetTourId = activeTour.id;
        tourName = activeTour.name;
        configTatamiCount = Number((activeTour.config as any)?.tatami_count) || 2;
      }
    } else {
      const { data: tour } = await supabase
        .from('tournaments')
        .select('name, config')
        .eq('id', targetTourId)
        .maybeSingle();
      if (tour) {
        tourName = tour.name;
        configTatamiCount = Number((tour.config as any)?.tatami_count) || 2;
      }
    }

    if (!targetTourId) {
      return { success: false, tournamentId: '', tournamentName: '', columns: [], error: 'No hay campeonato activo' };
    }

    // Consultar todos los combates del torneo
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
        category:categories (
          name
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
      .neq('status', 'CANCELLED')
      .order('tatami_number', { ascending: true })
      .order('match_number', { ascending: true });

    if (error) {
      console.warn('[getAllTatamisQueueAction] Error consultando combates:', error.message);
      return { success: false, tournamentId: targetTourId, tournamentName: tourName, columns: [], error: error.message };
    }

    // Normalizar todos los combates
    const normalized = (data || []).map((m: any) => {
      const whiteAth = Array.isArray(m.white_athlete) ? m.white_athlete[0] : m.white_athlete;
      const blueAth = Array.isArray(m.blue_athlete) ? m.blue_athlete[0] : m.blue_athlete;
      const categoryObj = Array.isArray(m.category) ? m.category[0] : m.category;

      const whiteName = whiteAth
        ? `${whiteAth.first_name || ''} ${whiteAth.last_name || ''}`.trim()
        : 'Por definir';
      const blueName = blueAth
        ? `${blueAth.first_name || ''} ${blueAth.last_name || ''}`.trim()
        : 'Por definir';

      return {
        id: m.id,
        match_number: m.match_number,
        tatami_number: m.tatami_number,
        category_name: categoryObj?.name || 'Categoría Oficial',
        round_name: formatRoundName(m.round),
        white_athlete_name: whiteName,
        white_club_name: whiteAth?.club?.name || (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente'),
        blue_athlete_name: blueName,
        blue_club_name: blueAth?.club?.name || (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente'),
        status: m.status as any,
      };
    });

    // Detectar cantidad de tatamis según configuración y combates
    const maxTatamiNumber = Math.max(
      configTatamiCount,
      ...normalized.map((m) => m.tatami_number),
      1
    );

    // Agrupar por tatami y computar el conteo relativo de cada combate en la cola
    const columns: TatamiColumn[] = [];

    for (let t = 1; t <= maxTatamiNumber; t++) {
      const tatamiMatches = normalized
        .filter((m) => m.tatami_number === t)
        .sort((a, b) => a.match_number - b.match_number);

      const finished = tatamiMatches.filter((m) => m.status === 'FINISHED');

      // 1. Detectar el combate actualmente en tatami (ONGOING, o el primer SCHEDULED listo en la mesa)
      let activeMatchItem = tatamiMatches.find((m) => m.status === 'ONGOING') || null;
      let remainingUpcoming: typeof tatamiMatches = [];

      if (activeMatchItem) {
        remainingUpcoming = tatamiMatches.filter(
          (m) => (m.status === 'SCHEDULED' || m.status === 'PENDING') && m.id !== activeMatchItem!.id
        );
      } else {
        const firstReady = tatamiMatches.find(
          (m) => m.status === 'SCHEDULED' || m.status === 'PENDING'
        );
        if (firstReady) {
          activeMatchItem = firstReady;
          remainingUpcoming = tatamiMatches.filter(
            (m) => (m.status === 'SCHEDULED' || m.status === 'PENDING') && m.id !== firstReady.id
          );
        }
      }

      // 2. Calcular cuenta de espera para los combates siguientes en la cola
      // (1 = Próximo combate a entrar, 2 = En 2 combates...)
      const upcomingWithCountdown: MultiTatamiMatch[] = remainingUpcoming.map((m, idx) => ({
        ...m,
        matchesUntilStart: idx + 1,
      }));

      const activeMulti: MultiTatamiMatch | null = activeMatchItem
        ? { ...activeMatchItem, matchesUntilStart: 0 }
        : null;

      columns.push({
        tatamiNumber: t,
        activeMatch: activeMulti,
        upcomingMatches: upcomingWithCountdown,
        finishedMatches: finished.map((m) => ({ ...m, matchesUntilStart: -1 })),
        totalMatches: tatamiMatches.length,
      });
    }

    return {
      success: true,
      tournamentId: targetTourId,
      tournamentName: tourName,
      columns,
    };
  } catch (err: any) {
    console.error('[getAllTatamisQueueAction] Error inesperado:', err);
    return { success: false, tournamentId: '', tournamentName: '', columns: [], error: err.message };
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
 * Obtiene el siguiente combate programado (SCHEDULED) para un tatami.
 * Ejecuta en el servidor con privilegios administrativos (bypasseando RLS).
 * 1. Prioriza el siguiente correlativo (match_number > currentMatchNumber).
 * 2. Si no hay combates posteriores, busca combates programados anteriores pendientes (recuperación de combates saltados).
 */
export async function getNextScheduledTatamiMatchAction(params: {
  tatamiNumber: number;
  tournamentId?: string;
  currentMatchNumber?: number;
  currentMatchId?: string;
}): Promise<{ success: boolean; match?: any; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { tatamiNumber, tournamentId, currentMatchNumber, currentMatchId } = params;

    let targetTourId = tournamentId;
    if (!targetTourId) {
      const { data: activeTour } = await supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      targetTourId = activeTour?.id;
    }

    const selectQuery = `
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
    `;

    let nextMatchData: any = null;

    // 1. Prioridad: Siguiente combate correlativo (match_number > currentMatchNumber)
    if (currentMatchNumber !== undefined && currentMatchNumber !== null) {
      let subsequentQuery = supabase
        .from('matches')
        .select(selectQuery)
        .eq('tatami_number', tatamiNumber)
        .eq('status', 'SCHEDULED')
        .gt('match_number', currentMatchNumber);

      if (targetTourId) {
        subsequentQuery = subsequentQuery.eq('tournament_id', targetTourId);
      }
      if (currentMatchId) {
        subsequentQuery = subsequentQuery.neq('id', currentMatchId);
      }

      const { data: subsequentData } = await subsequentQuery
        .order('match_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (subsequentData) {
        nextMatchData = subsequentData;
      }
    }

    // 2. Si no hay posteriores, buscar si quedó algún combate programado pendiente anterior
    if (!nextMatchData) {
      let lowestQuery = supabase
        .from('matches')
        .select(selectQuery)
        .eq('tatami_number', tatamiNumber)
        .eq('status', 'SCHEDULED');

      if (targetTourId) {
        lowestQuery = lowestQuery.eq('tournament_id', targetTourId);
      }
      if (currentMatchId) {
        lowestQuery = lowestQuery.neq('id', currentMatchId);
      }

      const { data: lowestData } = await lowestQuery
        .order('match_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (lowestData) {
        nextMatchData = lowestData;
      }
    }

    if (!nextMatchData) {
      return { success: true, match: null };
    }

    const rawData = nextMatchData as any;
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
      id: rawData.id,
      tournament_id: rawData.tournament_id,
      category_id: rawData.category_id,
      category_name: categoryObj?.name || 'Categoría Oficial',
      tatami_number: rawData.tatami_number,
      match_number: rawData.match_number,
      round: rawData.round || 'Ronda Oficial',
      round_name: formatRoundName(rawData.round),
      white_athlete_name: whiteName,
      white_club_name: whiteAth?.club?.name || (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente'),
      blue_athlete_name: blueName,
      blue_club_name: blueAth?.club?.name || (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente'),
      match_duration_seconds: categoryObj?.match_duration_seconds || 240,
      status: rawData.status || 'SCHEDULED',
      current_time_seconds: rawData.current_match_time_seconds || 0,
      next_match_id: rawData.next_match_id || null,
      next_match_slot: rawData.next_match_slot || null,
      white_athlete_id: rawData.white_athlete_id || null,
      blue_athlete_id: rawData.blue_athlete_id || null,
      updated_at: new Date().toISOString(),
    };

    return { success: true, match: matchPayload };
  } catch (err: any) {
    console.error('[getNextScheduledTatamiMatchAction] Error:', err);
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

    // 1. Obtener la categoría para conocer el tournament_id y organization_id reales
    const { data: cat } = await supabase
      .from('categories')
      .select('id, tournament_id, organization_id')
      .eq('id', categoryId)
      .maybeSingle();

    const actualTourId = cat?.tournament_id || tournamentId;
    const actualOrgId = cat?.organization_id || 'a0000000-0000-0000-0000-000000000001';

    // 2. Eliminar combates anteriores de esta categoría en este torneo
    await supabase
      .from('matches')
      .delete()
      .eq('category_id', categoryId)
      .eq('tournament_id', actualTourId);

    // 3. Inserción pura en PostgreSQL
    const matchesToInsert = bracketResult.matches.map((m) => ({
      id: m.id,
      organization_id: m.organization_id || actualOrgId,
      tournament_id: m.tournament_id || actualTourId,
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

/**
 * Re-secuencia todos los combates de un tatami utilizando el secuenciador anticonsecutivo IJF.
 * Garantiza números correlativos continuos (1, 2, 3...) y descansos balanceados.
 */
export async function resequenceTatamiMatchesAction(
  tournamentId: string,
  tatamiNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('tatami_number', tatamiNumber)
      .order('match_number', { ascending: true });

    if (error || !matches || matches.length === 0) {
      return { success: true };
    }

    const sequenced = sequenceTatamiMatches(matches as any[], 1);

    for (const m of sequenced) {
      await supabase
        .from('matches')
        .update({ match_number: m.match_number })
        .eq('id', m.id);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[resequenceTatamiMatchesAction] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reasigna una categoría completa a un nuevo tatami.
 * Si ya tiene combates generados, migra los combates y re-secuencia ambos tatamis afectados.
 */
export async function reassignCategoryTatamiAction(params: {
  categoryId: string;
  newTatamiNumber: number;
  tournamentId: string;
}): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { categoryId, newTatamiNumber, tournamentId } = params;

    if (!categoryId || !newTatamiNumber || !tournamentId) {
      return { success: false, message: 'Parámetros incompletos.', error: 'INVALID_PARAMS' };
    }

    // 1. Obtener la categoría actual
    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('id, name, assigned_tatami_number')
      .eq('id', categoryId)
      .single();

    if (catErr || !category) {
      return { success: false, message: 'Categoría no encontrada.', error: catErr?.message };
    }

    const oldTatami = category.assigned_tatami_number;

    // 2. Actualizar el tatami asignado en la tabla categories
    const { error: updateErr } = await supabase
      .from('categories')
      .update({ assigned_tatami_number: newTatamiNumber })
      .eq('id', categoryId);

    if (updateErr) {
      return { success: false, message: 'Error actualizando categoría.', error: updateErr.message };
    }

    // 3. Si la categoría ya tiene combates generados, migrar sus combates al nuevo tatami
    const { data: matchesToMove } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('category_id', categoryId);

    if (matchesToMove && matchesToMove.length > 0) {
      await supabase
        .from('matches')
        .update({ tatami_number: newTatamiNumber })
        .eq('tournament_id', tournamentId)
        .eq('category_id', categoryId);

      // Re-secuenciar ambos tatamis
      await resequenceTatamiMatchesAction(tournamentId, newTatamiNumber);
      if (oldTatami && oldTatami !== newTatamiNumber) {
        await resequenceTatamiMatchesAction(tournamentId, oldTatami);
      }
    }

    return {
      success: true,
      message: `Categoría "${category.name}" reasignada exitosamente al Tatami #${newTatamiNumber}.`,
    };
  } catch (err: any) {
    console.error('[reassignCategoryTatamiAction] Error:', err);
    return { success: false, message: 'Error inesperado reasignando tatami.', error: err.message };
  }
}

/**
 * Crea una nueva categoría dentro de un campeonato activo y le asigna un tatami.
 */
export async function createTournamentCategoryAction(params: {
  tournamentId: string;
  name: string;
  age_group?: string;
  gender?: 'M' | 'F' | 'MIXED';
  max_weight?: number;
  match_duration_seconds?: number;
  assigned_tatami_number?: number;
}): Promise<{ success: boolean; category?: any; message: string; error?: string }> {
  try {
    const supabase = createAdminClient();
    const {
      tournamentId,
      name,
      age_group = 'Senior',
      gender = 'M',
      max_weight = 73,
      match_duration_seconds = 240,
      assigned_tatami_number,
    } = params;

    if (!tournamentId || !name) {
      return { success: false, message: 'Nombre y torneo son obligatorios.', error: 'INVALID_PARAMS' };
    }

    // 1. Obtener organización del torneo
    const { data: tourData } = await supabase
      .from('tournaments')
      .select('id, organization_id, config')
      .eq('id', tournamentId)
      .single();

    const orgId = tourData?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const tatamiCount = Number((tourData?.config as any)?.tatami_count) || 2;

    // 2. Determinar tatami asignado si no fue especificado
    let targetTatami = assigned_tatami_number;
    if (!targetTatami || targetTatami <= 0) {
      const { data: existingCats } = await supabase
        .from('categories')
        .select('assigned_tatami_number')
        .eq('tournament_id', tournamentId);

      const counts = new Map<number, number>();
      for (let t = 1; t <= tatamiCount; t++) counts.set(t, 0);
      (existingCats || []).forEach((c) => {
        if (c.assigned_tatami_number) {
          counts.set(c.assigned_tatami_number, (counts.get(c.assigned_tatami_number) || 0) + 1);
        }
      });

      let minCount = Infinity;
      targetTatami = 1;
      for (let t = 1; t <= tatamiCount; t++) {
        const val = counts.get(t) || 0;
        if (val < minCount) {
          minCount = val;
          targetTatami = t;
        }
      }
    }

    // 3. Insertar la nueva categoría
    const newCategoryPayload = {
      tournament_id: tournamentId,
      organization_id: orgId,
      name: name.trim(),
      age_group,
      gender,
      max_weight,
      match_duration_seconds,
      assigned_tatami_number: targetTatami,
    };

    const { data: createdCat, error: insertErr } = await supabase
      .from('categories')
      .insert(newCategoryPayload)
      .select()
      .single();

    if (insertErr) {
      return { success: false, message: 'Error creando la categoría.', error: insertErr.message };
    }

    return {
      success: true,
      category: createdCat,
      message: `Categoría "${name}" creada exitosamente y asignada al Tatami #${targetTatami}.`,
    };
  } catch (err: any) {
    console.error('[createTournamentCategoryAction] Error:', err);
    return { success: false, message: 'Error inesperado creando categoría.', error: err.message };
  }
}

export interface CategoryPodiumResult {
  categoryId: string;
  categoryName: string;
  ageGroup: string;
  gender: string;
  isFinished: boolean;
  totalMatches: number;
  finishedMatches: number;
  podium: {
    firstPlace: { athleteId: string; name: string; club: string } | null;
    secondPlace: { athleteId: string; name: string; club: string } | null;
    thirdPlaceA: { athleteId: string; name: string; club: string } | null;
    thirdPlaceB: { athleteId: string; name: string; club: string } | null;
    fifthPlaces: { athleteId: string; name: string; club: string }[];
    seventhPlaces: { athleteId: string; name: string; club: string }[];
  };
}

/**
 * Calcula y retorna el podio oficial (1°, 2°, Doble 3°, 5° y 7° lugar) de las categorías del campeonato.
 */
export async function getTournamentPodiumsAction(
  tournamentId: string
): Promise<{ success: boolean; results: CategoryPodiumResult[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. Obtener categorías del campeonato
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, age_group, gender')
      .eq('tournament_id', tournamentId);

    if (catErr || !categories) {
      return { success: false, results: [], error: catErr?.message };
    }

    // 2. Obtener todos los combates del torneo
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select(`
        id,
        category_id,
        round,
        status,
        winner_id,
        white_athlete_id,
        blue_athlete_id,
        white_athlete:athletes!matches_white_athlete_id_fkey (id, first_name, last_name, club:clubs (name)),
        blue_athlete:athletes!matches_blue_athlete_id_fkey (id, first_name, last_name, club:clubs (name))
      `)
      .eq('tournament_id', tournamentId)
      .neq('status', 'CANCELLED');

    if (matchErr) {
      return { success: false, results: [], error: matchErr?.message };
    }

    const athleteCache = new Map<string, { id: string; name: string; club: string }>();
    (matches || []).forEach((m: any) => {
      const w = Array.isArray(m.white_athlete) ? m.white_athlete[0] : m.white_athlete;
      const b = Array.isArray(m.blue_athlete) ? m.blue_athlete[0] : m.blue_athlete;
      if (w?.id) {
        athleteCache.set(w.id, {
          id: w.id,
          name: `${w.first_name || ''} ${w.last_name || ''}`.trim(),
          club: w.club?.name || (Array.isArray(w.club) ? w.club[0]?.name : 'Independiente'),
        });
      }
      if (b?.id) {
        athleteCache.set(b.id, {
          id: b.id,
          name: `${b.first_name || ''} ${b.last_name || ''}`.trim(),
          club: b.club?.name || (Array.isArray(b.club) ? b.club[0]?.name : 'Independiente'),
        });
      }
    });

    const results: CategoryPodiumResult[] = categories.map((cat) => {
      const catMatches = (matches || []).filter((m: any) => m.category_id === cat.id);
      const totalMatches = catMatches.length;
      const finishedMatches = catMatches.filter((m: any) => m.status === 'FINISHED').length;

      let firstPlace: { athleteId: string; name: string; club: string } | null = null;
      let secondPlace: { athleteId: string; name: string; club: string } | null = null;
      let thirdPlaceA: { athleteId: string; name: string; club: string } | null = null;
      let thirdPlaceB: { athleteId: string; name: string; club: string } | null = null;
      const fifthPlaces: { athleteId: string; name: string; club: string }[] = [];
      const seventhPlaces: { athleteId: string; name: string; club: string }[] = [];

      // A. Comprobar si es Best of 3 o Eliminación simple
      const finalMatch = catMatches.find((m: any) => m.round === 'FINAL' || m.round.includes('FINAL'));
      const bo3Matches = catMatches.filter((m: any) => m.round.startsWith('BEST_OF_3'));

      if (finalMatch && finalMatch.winner_id) {
        const champ = athleteCache.get(finalMatch.winner_id);
        if (champ) firstPlace = { athleteId: champ.id, name: champ.name, club: champ.club };

        const runnerUpId = finalMatch.winner_id === finalMatch.white_athlete_id ? finalMatch.blue_athlete_id : finalMatch.white_athlete_id;
        if (runnerUpId) {
          const runnerUp = athleteCache.get(runnerUpId);
          if (runnerUp) secondPlace = { athleteId: runnerUp.id, name: runnerUp.name, club: runnerUp.club };
        }
      } else if (bo3Matches.length > 0) {
        const bo3Wins = new Map<string, number>();
        bo3Matches.forEach((m: any) => {
          if (m.winner_id) bo3Wins.set(m.winner_id, (bo3Wins.get(m.winner_id) || 0) + 1);
        });
        for (const [athId, wins] of bo3Wins.entries()) {
          if (wins >= 2) {
            const champ = athleteCache.get(athId);
            if (champ) firstPlace = { athleteId: champ.id, name: champ.name, club: champ.club };
          }
        }
        if (firstPlace) {
          const m1 = bo3Matches[0];
          const runnerUpId = m1?.white_athlete_id === firstPlace.athleteId ? m1?.blue_athlete_id : m1?.white_athlete_id;
          if (runnerUpId) {
            const ru = athleteCache.get(runnerUpId);
            if (ru) secondPlace = { athleteId: ru.id, name: ru.name, club: ru.club };
          }
        }
      } else if (catMatches.some((m: any) => m.round.startsWith('RR_'))) {
        // En Round Robin (Liga), ordenar por victorias
        const rrWins = new Map<string, number>();
        catMatches.forEach((m: any) => {
          if (m.winner_id) rrWins.set(m.winner_id, (rrWins.get(m.winner_id) || 0) + 1);
        });
        const sorted = Array.from(rrWins.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted[0]) {
          const a = athleteCache.get(sorted[0][0]);
          if (a) firstPlace = { athleteId: a.id, name: a.name, club: a.club };
        }
        if (sorted[1]) {
          const a = athleteCache.get(sorted[1][0]);
          if (a) secondPlace = { athleteId: a.id, name: a.name, club: a.club };
        }
        if (sorted[2]) {
          const a = athleteCache.get(sorted[2][0]);
          if (a) thirdPlaceA = { athleteId: a.id, name: a.name, club: a.club };
        }
      }

      // B. Doble Bronce (BRONZE_1 y BRONZE_2)
      const b1 = catMatches.find((m: any) => m.round === 'BRONZE_1');
      const b2 = catMatches.find((m: any) => m.round === 'BRONZE_2');
      const singleBronze = catMatches.find((m: any) => m.round === 'BRONZE');

      if (b1 && b1.winner_id) {
        const ath = athleteCache.get(b1.winner_id);
        if (ath) thirdPlaceA = { athleteId: ath.id, name: ath.name, club: ath.club };
        const loserId = b1.winner_id === b1.white_athlete_id ? b1.blue_athlete_id : b1.white_athlete_id;
        if (loserId) {
          const lAth = athleteCache.get(loserId);
          if (lAth) fifthPlaces.push({ athleteId: lAth.id, name: lAth.name, club: lAth.club });
        }
      }
      if (b2 && b2.winner_id) {
        const ath = athleteCache.get(b2.winner_id);
        if (ath) thirdPlaceB = { athleteId: ath.id, name: ath.name, club: ath.club };
        const loserId = b2.winner_id === b2.white_athlete_id ? b2.blue_athlete_id : b2.white_athlete_id;
        if (loserId) {
          const lAth = athleteCache.get(loserId);
          if (lAth) fifthPlaces.push({ athleteId: lAth.id, name: lAth.name, club: lAth.club });
        }
      }
      if (singleBronze && singleBronze.winner_id && !thirdPlaceA) {
        const ath = athleteCache.get(singleBronze.winner_id);
        if (ath) thirdPlaceA = { athleteId: ath.id, name: ath.name, club: ath.club };
      }

      // C. Repechajes perdedores = 7° lugar
      const rep1 = catMatches.find((m: any) => m.round === 'REPECHAGE_1');
      const rep2 = catMatches.find((m: any) => m.round === 'REPECHAGE_2');
      if (rep1 && rep1.winner_id) {
        const loserId = rep1.winner_id === rep1.white_athlete_id ? rep1.blue_athlete_id : rep1.white_athlete_id;
        if (loserId) {
          const ath = athleteCache.get(loserId);
          if (ath) seventhPlaces.push({ athleteId: ath.id, name: ath.name, club: ath.club });
        }
      }
      if (rep2 && rep2.winner_id) {
        const loserId = rep2.winner_id === rep2.white_athlete_id ? rep2.blue_athlete_id : rep2.white_athlete_id;
        if (loserId) {
          const ath = athleteCache.get(loserId);
          if (ath) seventhPlaces.push({ athleteId: ath.id, name: ath.name, club: ath.club });
        }
      }

      const isFinished = totalMatches > 0 && finishedMatches === totalMatches;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        ageGroup: cat.age_group,
        gender: cat.gender,
        isFinished,
        totalMatches,
        finishedMatches,
        podium: {
          firstPlace,
          secondPlace,
          thirdPlaceA,
          thirdPlaceB,
          fifthPlaces,
          seventhPlaces,
        },
      };
    });

    return { success: true, results };
  } catch (err: any) {
    console.error('[getTournamentPodiumsAction] Error:', err);
    return { success: false, results: [], error: err.message };
  }
}
