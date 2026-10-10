// ==============================================================================
// SERVER ACTIONS: CONTROL DE COMBATES Y PROPAGACIÓN DE GANADORES EN EL ÁRBOL
// ==============================================================================
//
// REGLA DE NEGOCIO CRÍTICA (PROPAGACIÓN DE GANADORES):
// Al finalizar un combate en la Mesa de Control (status = 'FINISHED'):
// 1. Sella el combate actual con winner_id, win_reason y ended_at.
// 2. Si el combate tiene un next_match_id asignado, ejecuta un UPDATE automático
//    en ese combate futuro inyectando el winner_id en white_athlete_id o blue_athlete_id
//    (según next_match_slot).
// 3. Si el combate futuro ahora tiene ambos atletas asignados, activa su status a 'SCHEDULED'
//    para que ingrese automáticamente a la cola del tatami.
//
// ==============================================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface FinishMatchParams {
  matchId: string;
  winnerColor: 'WHITE' | 'BLUE';
  winReason?: string;
  whiteScore?: any;
  blueScore?: any;
  durationSeconds?: number;
}

export interface FinishMatchResult {
  success: boolean;
  message: string;
  matchId: string;
  winnerId: string | null;
  winnerName: string;
  winnerClub?: string;
  propagatedToNextMatch: boolean;
  nextMatchId?: string | null;
  nextMatchSlot?: 'WHITE' | 'BLUE' | null;
  nextMatchReady?: boolean;
  error?: string;
}

export async function finishMatchAndPropagateWinnerAction(
  params: FinishMatchParams
): Promise<FinishMatchResult> {
  const { matchId, winnerColor, winReason, whiteScore, blueScore } = params;

  if (!matchId) {
    return {
      success: false,
      message: 'ID de combate inválido.',
      matchId: '',
      winnerId: null,
      winnerName: '',
      propagatedToNextMatch: false,
      error: 'INVALID_MATCH_ID',
    };
  }

  try {
    const supabase = createAdminClient();

    // 1. Consultar el combate actual y sus atletas
    const { data: currentMatch, error: fetchErr } = await supabase
      .from('matches')
      .select(`
        id,
        tournament_id,
        category_id,
        tatami_number,
        match_number,
        round,
        white_athlete_id,
        blue_athlete_id,
        white_score,
        blue_score,
        status,
        next_match_id,
        next_match_slot,
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

    if (fetchErr) {
      console.warn('[finishMatch] Error consultando combate:', fetchErr.message);
    }

    const rawMatch = currentMatch as any;

    const whiteAth = Array.isArray(rawMatch?.white_athlete)
      ? rawMatch?.white_athlete[0]
      : rawMatch?.white_athlete;
    const blueAth = Array.isArray(rawMatch?.blue_athlete)
      ? rawMatch?.blue_athlete[0]
      : rawMatch?.blue_athlete;

    const whiteName = whiteAth
      ? `${whiteAth.first_name} ${whiteAth.last_name}`.trim()
      : 'Atleta Blanco';
    const blueName = blueAth
      ? `${blueAth.first_name} ${blueAth.last_name}`.trim()
      : 'Atleta Azul';
    const whiteClub =
      whiteAth?.club?.name ||
      (Array.isArray(whiteAth?.club) ? whiteAth.club[0]?.name : 'Independiente');
    const blueClub =
      blueAth?.club?.name ||
      (Array.isArray(blueAth?.club) ? blueAth.club[0]?.name : 'Independiente');

    // 2. Determinar el atleta ganador
    const winnerId = winnerColor === 'WHITE' ? rawMatch?.white_athlete_id : rawMatch?.blue_athlete_id;
    const winnerName = winnerColor === 'WHITE' ? whiteName : blueName;
    const winnerClub = winnerColor === 'WHITE' ? whiteClub : blueClub;

    const nowIso = new Date().toISOString();

    // 3. Sellar el combate actual como FINISHED
    const matchUpdatePayload: Record<string, any> = {
      status: 'FINISHED',
      winner_id: winnerId || null,
      win_reason: winReason || 'POINTS',
      ended_at: nowIso,
      updated_at: nowIso,
    };
    if (whiteScore) matchUpdatePayload.white_score = whiteScore;
    if (blueScore) matchUpdatePayload.blue_score = blueScore;

    const { error: updateCurrentErr } = await supabase
      .from('matches')
      .update(matchUpdatePayload)
      .eq('id', matchId);

    if (updateCurrentErr) {
      console.warn('[finishMatch] Advertencia actualizando combate actual:', updateCurrentErr.message);
    }

    // 4. PROPAGACIÓN ESTRICTA HACIA EL COMBATE SIGUIENTE (next_match_id)
    let propagated = false;
    let nextMatchReady = false;
    const nextMatchId = rawMatch?.next_match_id;
    const nextMatchSlot = (rawMatch?.next_match_slot as 'WHITE' | 'BLUE') || 'WHITE';

    if (nextMatchId && winnerId) {
      // a. Consultar el estado del combate siguiente
      const { data: nextMatchData } = await supabase
        .from('matches')
        .select('id, white_athlete_id, blue_athlete_id, status')
        .eq('id', nextMatchId)
        .maybeSingle();

      const nextPayload: Record<string, any> = {
        updated_at: nowIso,
      };

      if (nextMatchSlot === 'WHITE') {
        nextPayload.white_athlete_id = winnerId;
      } else {
        nextPayload.blue_athlete_id = winnerId;
      }

      // b. Si el slot opuesto ya tiene un atleta asignado, activar el combate a 'SCHEDULED'
      if (nextMatchData) {
        const opposingAthleteId =
          nextMatchSlot === 'WHITE' ? nextMatchData.blue_athlete_id : nextMatchData.white_athlete_id;

        if (opposingAthleteId) {
          nextPayload.status = 'SCHEDULED';
          nextMatchReady = true;
        }
      }

      // c. Ejecutar el UPDATE atómico en el combate futuro
      const { error: nextUpdateErr } = await supabase
        .from('matches')
        .update(nextPayload)
        .eq('id', nextMatchId);

      if (!nextUpdateErr) {
        propagated = true;
      } else {
        console.warn('[finishMatch] Error propagando al siguiente combate:', nextUpdateErr.message);
      }
    }

    return {
      success: true,
      message: `Combate finalizado. Ganador: ${winnerName}.${
        propagated ? ` Propagado exitosamente al siguiente cruce (${nextMatchSlot}).` : ''
      }`,
      matchId,
      winnerId: winnerId || null,
      winnerName,
      winnerClub,
      propagatedToNextMatch: propagated,
      nextMatchId: nextMatchId || null,
      nextMatchSlot: nextMatchSlot || null,
      nextMatchReady,
    };
  } catch (err: any) {
    console.error('[finishMatchAndPropagateWinnerAction] Error inesperado:', err);
    return {
      success: false,
      message: 'Error procesando la finalización del combate.',
      matchId,
      winnerId: null,
      winnerName: '',
      propagatedToNextMatch: false,
      error: err.message,
    };
  }
}
