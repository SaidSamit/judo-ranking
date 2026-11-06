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
        white_ippon,
        white_wazaari,
        white_yuko,
        white_shido,
        blue_ippon,
        blue_wazaari,
        blue_yuko,
        blue_shido,
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
      : 'Judoka Blanco';
    const blueName = blueAth
      ? `${blueAth.first_name} ${blueAth.last_name}`.trim()
      : 'Judoka Azul';
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
    if (whiteScore) {
      if (typeof whiteScore.ippon !== 'undefined') matchUpdatePayload.white_ippon = whiteScore.ippon;
      if (typeof whiteScore.wazaari !== 'undefined') matchUpdatePayload.white_wazaari = whiteScore.wazaari;
      if (typeof whiteScore.yuko !== 'undefined') matchUpdatePayload.white_yuko = whiteScore.yuko;
      if (typeof whiteScore.shido !== 'undefined') matchUpdatePayload.white_shido = whiteScore.shido;
    }
    if (blueScore) {
      if (typeof blueScore.ippon !== 'undefined') matchUpdatePayload.blue_ippon = blueScore.ippon;
      if (typeof blueScore.wazaari !== 'undefined') matchUpdatePayload.blue_wazaari = blueScore.wazaari;
      if (typeof blueScore.yuko !== 'undefined') matchUpdatePayload.blue_yuko = blueScore.yuko;
      if (typeof blueScore.shido !== 'undefined') matchUpdatePayload.blue_shido = blueScore.shido;
    }

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

    // 4.1. PROPAGACIÓN DE PERDEDORES: REGLAMENTO IJF (REPECHAJE Y DOBLE BRONCE)
    // - En Cuartos de Final (QF): El perdedor va a Repechaje 1 o Repechaje 2.
    // - En Semifinales (SF): El perdedor va al combate por Bronce cruzado (evitar revanchas).
    const loserId = winnerColor === 'WHITE' ? rawMatch?.blue_athlete_id : rawMatch?.white_athlete_id;
    const catId = rawMatch?.category_id;
    const roundCode = (rawMatch?.round || '').toUpperCase();

    if (loserId && catId && (roundCode === 'QF' || roundCode.startsWith('QF') || roundCode === 'SF' || roundCode.startsWith('SF') || roundCode === 'DP_SEMI')) {
      try {
        if (roundCode === 'QF' || roundCode.startsWith('QF')) {
          // Obtener combates clave de la categoría para resolver la rama estructural (Rama A vs Rama B)
          const { data: catMatches } = await supabase
            .from('matches')
            .select('id, round, next_match_id, next_match_slot')
            .eq('category_id', catId);

          const sfMatches = (catMatches || []).filter((m) => (m.round || '').toUpperCase().startsWith('SF'));
          const sf1 = sfMatches.find((m) => m.next_match_slot === 'WHITE') || sfMatches[0];
          const sf2 = sfMatches.find((m) => m.next_match_slot === 'BLUE') || sfMatches[1];

          // Determinar a qué rama pertenece este combate de cuartos según la semifinal que alimenta
          const isRamaA = sf1 && rawMatch?.next_match_id === sf1.id;
          const targetRepRound = isRamaA ? 'REPECHAGE_1' : 'REPECHAGE_2';
          // El slot en repechaje replica el slot de entrada a semifinales
          const targetSlot = rawMatch?.next_match_slot === 'WHITE' ? 'white_athlete_id' : 'blue_athlete_id';

          const { data: repMatch } = await supabase
            .from('matches')
            .select('id, white_athlete_id, blue_athlete_id, status')
            .eq('category_id', catId)
            .eq('round', targetRepRound)
            .maybeSingle();

          if (repMatch) {
            const repUpdate: Record<string, any> = {
              [targetSlot]: loserId,
              updated_at: nowIso,
            };
            const oppositeSlot = targetSlot === 'white_athlete_id' ? repMatch.blue_athlete_id : repMatch.white_athlete_id;
            if (oppositeSlot) {
              repUpdate.status = 'SCHEDULED';
            }
            await supabase.from('matches').update(repUpdate).eq('id', repMatch.id);
          }
        } else if (roundCode === 'SF' || roundCode.startsWith('SF')) {
          // EN SEMIFINALES (REGLA OFICIAL IJF):
          // El árbol principal nunca cruza pools. El ÚNICO cruce oficial es aquí:
          // - El perdedor de Semifinal 1 (Rama A) cruza a Disputa por Bronce B (BRONZE_2) frente al ganador de Repechaje 2
          // - El perdedor de Semifinal 2 (Rama B) cruza a Disputa por Bronce A (BRONZE_1) frente al ganador de Repechaje 1
          const isSF1 = rawMatch?.next_match_slot === 'WHITE';
          const targetBronzeRound = isSF1 ? 'BRONZE_2' : 'BRONZE_1';

          const { data: bronzeMatch } = await supabase
            .from('matches')
            .select('id, white_athlete_id, blue_athlete_id, status')
            .eq('category_id', catId)
            .eq('round', targetBronzeRound)
            .maybeSingle();

          if (bronzeMatch) {
            const bronzeUpdate: Record<string, any> = {
              white_athlete_id: loserId,
              updated_at: nowIso,
            };
            if (bronzeMatch.blue_athlete_id) {
              bronzeUpdate.status = 'SCHEDULED';
            }
            await supabase.from('matches').update(bronzeUpdate).eq('id', bronzeMatch.id);
          }
        } else if (roundCode === 'DP_SEMI') {
          // En Pool Doble: Perdedor de la Semifinal Directa va a DP_BRONZE (BLUE)
          const { data: dpBronzeMatch } = await supabase
            .from('matches')
            .select('id, white_athlete_id, status')
            .eq('category_id', catId)
            .eq('round', 'DP_BRONZE')
            .maybeSingle();

          if (dpBronzeMatch) {
            const bronzeUpdate: Record<string, any> = {
              blue_athlete_id: loserId,
              updated_at: nowIso,
            };
            if (dpBronzeMatch.white_athlete_id) {
              bronzeUpdate.status = 'SCHEDULED';
            }
            await supabase.from('matches').update(bronzeUpdate).eq('id', dpBronzeMatch.id);
          }
        }
      } catch (loserErr) {
        console.warn('[finishMatch] Error propagando perdedor a repechaje/bronce:', loserErr);
      }
    }

    // 4.2. PROPAGACIÓN POOL A EN POOL DOBLE (5 COMPETIDORES):
    // Cuando finalizan los 3 combates del Pool A, 1° pasa a DP_FINAL y 2° pasa a DP_BRONZE
    if (roundCode.startsWith('DP_POOL_A') && catId) {
      try {
        const { data: poolAMatches } = await supabase
          .from('matches')
          .select('id, round, status, winner_id, white_athlete_id, blue_athlete_id, white_ippon, white_wazaari, blue_ippon, blue_wazaari')
          .eq('category_id', catId)
          .ilike('round', 'DP_POOL_A%');

        if (poolAMatches) {
          const effMatches = poolAMatches.map((m) =>
            m.id === matchId ? { ...m, status: 'FINISHED', winner_id: winnerId } : m
          );
          const allFinished = effMatches.every((m) => m.status === 'FINISHED');
          if (allFinished) {
            const stats = new Map<string, { wins: number; points: number }>();
            effMatches.forEach((m) => {
              if (m.white_athlete_id && !stats.has(m.white_athlete_id)) stats.set(m.white_athlete_id, { wins: 0, points: 0 });
              if (m.blue_athlete_id && !stats.has(m.blue_athlete_id)) stats.set(m.blue_athlete_id, { wins: 0, points: 0 });
              if (m.winner_id) {
                const s = stats.get(m.winner_id);
                if (s) {
                  s.wins += 1;
                  const pts = m.winner_id === m.white_athlete_id
                    ? (m.white_ippon * 10 + m.white_wazaari * 7)
                    : (m.blue_ippon * 10 + m.blue_wazaari * 7);
                  s.points += pts || 10;
                }
              }
            });

            const sortedPoolA = Array.from(stats.entries()).sort((a, b) => {
              if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
              return b[1].points - a[1].points;
            });

            if (sortedPoolA.length >= 2) {
              const firstPoolA = sortedPoolA[0][0];
              const secondPoolA = sortedPoolA[1][0];

              // 1° de Pool A va a DP_FINAL (WHITE)
              const { data: finalM } = await supabase
                .from('matches')
                .select('id, blue_athlete_id')
                .eq('category_id', catId)
                .eq('round', 'DP_FINAL')
                .maybeSingle();

              if (finalM) {
                const fUp: Record<string, any> = { white_athlete_id: firstPoolA, updated_at: nowIso };
                if (finalM.blue_athlete_id) fUp.status = 'SCHEDULED';
                await supabase.from('matches').update(fUp).eq('id', finalM.id);
              }

              // 2° de Pool A va a DP_BRONZE (WHITE)
              const { data: bronzeM } = await supabase
                .from('matches')
                .select('id, blue_athlete_id')
                .eq('category_id', catId)
                .eq('round', 'DP_BRONZE')
                .maybeSingle();

              if (bronzeM) {
                const bUp: Record<string, any> = { white_athlete_id: secondPoolA, updated_at: nowIso };
                if (bronzeM.blue_athlete_id) bUp.status = 'SCHEDULED';
                await supabase.from('matches').update(bUp).eq('id', bronzeM.id);
              }
            }
          }
        }
      } catch (poolAErr) {
        console.warn('[finishMatch] Error propagando clasificados de Pool A:', poolAErr);
      }
    }

    // 5. REGLA OFICIAL AL MEJOR DE 3 (BEST OF 3):
    // Si un judoka gana 2 combates de la serie (2-0), el combate 3 (desempate) se cancela automáticamente.
    let bo3Cancelled = false;
    if (roundCode.startsWith('BEST_OF_3') && rawMatch?.category_id) {
      try {
        const { data: bo3Matches } = await supabase
          .from('matches')
          .select('id, round, winner_id, status')
          .eq('category_id', rawMatch.category_id)
          .ilike('round', 'BEST_OF_3%');

        if (bo3Matches && bo3Matches.length > 0) {
          const winCounts = new Map<string, number>();
          bo3Matches.forEach((m) => {
            const effWinner = m.id === matchId ? winnerId : m.winner_id;
            if (effWinner) {
              winCounts.set(effWinner, (winCounts.get(effWinner) || 0) + 1);
            }
          });

          // Verificar si algún competidor alcanzó 2 victorias
          const hasTwoWins = Array.from(winCounts.values()).some((count) => count >= 2);
          if (hasTwoWins) {
            const deciderMatch = bo3Matches.find(
              (m) =>
                (m.round.includes('M3') || m.round.includes('DECIDER')) &&
                m.status !== 'FINISHED' &&
                m.status !== 'CANCELLED'
            );

            if (deciderMatch) {
              const { error: cancelErr } = await supabase
                .from('matches')
                .update({
                  status: 'CANCELLED',
                  updated_at: nowIso,
                })
                .eq('id', deciderMatch.id);

              if (!cancelErr) {
                bo3Cancelled = true;
              } else {
                console.warn('[finishMatch] Error cancelando combate 3 de Best of 3:', cancelErr.message);
              }
            }
          }
        }
      } catch (bo3Err) {
        console.warn('[finishMatch] Error evaluando regla Best of 3:', bo3Err);
      }
    }

    return {
      success: true,
      message: `Combate finalizado. Ganador: ${winnerName}.${
        propagated ? ` Propagado exitosamente al siguiente cruce (${nextMatchSlot}).` : ''
      }${bo3Cancelled ? ' Serie concluida (2-0): Combate de desempate cancelado.' : ''}`,
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

/**
 * Actualiza el estado de un combate en Supabase (ej: 'ONGOING', 'PAUSED').
 * Utilizado por la Mesa de Control para notificar inmediatamente a la cola y marcador.
 */
export async function updateMatchStatusAction(
  matchId: string,
  status: 'SCHEDULED' | 'ONGOING' | 'PAUSED' | 'FINISHED'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('matches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', matchId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Consulta un combate por su UUID específico para la mesa de control (ej: al hacer clic en "Llamar a Tatami").
 */
export async function getMatchByIdAction(matchId: string): Promise<{
  success: boolean;
  match?: any;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();
    const { data: m, error } = await supabase
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
        white_ippon,
        white_wazaari,
        white_yuko,
        white_shido,
        blue_ippon,
        blue_wazaari,
        blue_yuko,
        blue_shido,
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

    if (error || !m) {
      return { success: false, error: error?.message || 'Combate no encontrado.' };
    }

    const whiteAth = Array.isArray(m.white_athlete) ? m.white_athlete[0] : m.white_athlete;
    const blueAth = Array.isArray(m.blue_athlete) ? m.blue_athlete[0] : m.blue_athlete;

    const normalizedMatch = {
      id: m.id,
      tournament_id: m.tournament_id,
      category_id: m.category_id,
      category_name: (m.category as any)?.name || 'Categoría Oficial',
      tatami_number: m.tatami_number || 1,
      match_number: m.match_number || 1,
      white_athlete_name: whiteAth
        ? `${whiteAth.first_name || ''} ${whiteAth.last_name || ''}`.trim()
        : 'Judoka Blanco',
      white_club_name:
        (whiteAth?.club as any)?.name ||
        (Array.isArray(whiteAth?.club) ? (whiteAth.club[0] as any)?.name : 'Independiente'),
      blue_athlete_name: blueAth
        ? `${blueAth.first_name || ''} ${blueAth.last_name || ''}`.trim()
        : 'Judoka Azul',
      blue_club_name:
        (blueAth?.club as any)?.name ||
        (Array.isArray(blueAth?.club) ? (blueAth.club[0] as any)?.name : 'Independiente'),
      white_athlete_id: m.white_athlete_id || null,
      blue_athlete_id: m.blue_athlete_id || null,
      next_match_id: m.next_match_id || null,
      next_match_slot: m.next_match_slot || null,
      match_duration_seconds: (m.category as any)?.match_duration_seconds || 240,
      status: m.status || 'SCHEDULED',
      current_time_seconds: m.current_match_time_seconds || 0,
      updated_at: new Date().toISOString(),
    };

    return { success: true, match: normalizedMatch };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

