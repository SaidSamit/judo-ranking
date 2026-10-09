// ==============================================================================
// MOTOR DE REGLAS DEPORTIVAS IJF (FUNCIONES PURAS / EVENT PROJECTIONS)
// ==============================================================================
//
// ¿POR QUÉ UNA FUNCIÓN PURA?
// En Event Sourcing, el estado NO se muta. El marcador actual es una
// "Proyección Matemática" determinista de todos los eventos válidos.
// Si hay 100 eventos y revertimos 1, volvemos a proyectar y el resultado
// es 100% predecible, sin condiciones de carrera.
//
// ==============================================================================

import { MatchEvent, MatchProjection, ScoreState, CombatantColor } from '@/types/events';

export function createInitialScore(): ScoreState {
  return {
    ippon: 0,
    wazaari: 0,
    yuko: 0,
    shido: 0,
    has_hansoku_make: false,
    has_hansoku_make_direct: false,
    has_hansoku_make_indirect: false,
  };
}

/**
 * Proyecta la secuencia inmutable de eventos hacia el estado actual del combate.
 */
export function projectMatchState(events: MatchEvent[]): MatchProjection {
  const white_score = createInitialScore();
  const blue_score = createInitialScore();

  let is_clock_running = false;
  let active_osaekomi: CombatantColor | null = null;
  let osaekomi_seconds = 0;
  let winner: CombatantColor | null = null;
  let win_reason: string | null = null;
  let has_direct_hansoku_make = false;
  let direct_hansoku_target: CombatantColor | null = null;

  // Filtrar solo eventos activos (que no hayan sido anulados por Undo)
  const activeEvents = events
    .filter((e) => !e.is_undone)
    .sort((a, b) => a.sequence_number - b.sequence_number);

  for (const event of activeEvents) {
    const targetScore = event.target === 'WHITE' ? white_score : blue_score;
    const opponentScore = event.target === 'WHITE' ? blue_score : white_score;
    const opponentColor: CombatantColor = event.target === 'WHITE' ? 'BLUE' : 'WHITE';

    switch (event.action) {
      case 'ADD_IPPON':
        targetScore.ippon = 1;
        winner = event.target;
        win_reason = 'IPPON';
        break;

      case 'ADD_WAZA_ARI':
        targetScore.wazaari += 1;
        // Regla IJF: 2 Waza-aris equivalen a Ippon (Waza-ari-awasete-Ippon)
        // Absorción Visual: Al completarse el 2º Waza-ari, se corona el Ippon y se resetea
        // wazaari a 0 exclusivamente en la proyección. Los eventos originales ADD_WAZA_ARI
        // permanecen intactos en la pila para permitir "Undo" (Shift + W) de vuelta a 1 Waza-ari.
        if (targetScore.wazaari >= 2) {
          targetScore.ippon = 1;
          targetScore.wazaari = 0;
          winner = event.target;
          win_reason = 'WAZA_ARI_AWASETE_IPPON';
        }
        break;

      case 'ADD_YUKO':
        targetScore.yuko += 1;
        break;

      case 'ADD_SHIDO':
        targetScore.shido += 1;
        // Regla IJF: 3 Shidos = Hansoku-make INDIRECTO automático (Técnico por defecto, NO requiere modal)
        if (targetScore.shido >= 3) {
          targetScore.has_hansoku_make = true;
          targetScore.has_hansoku_make_indirect = true;
          winner = opponentColor;
          win_reason = 'HANSOKU_MAKE_INDIRECT (3 SHIDOS)';
        }
        break;

      case 'ADD_HANSOKU_MAKE':
        // Hansoku-make DIRECTO intencional (Expulsión directa: Requiere tipificación técnica vs disciplinaria)
        targetScore.has_hansoku_make = true;
        targetScore.has_hansoku_make_direct = true;
        winner = opponentColor;
        win_reason = 'HANSOKU_MAKE_DIRECT';
        has_direct_hansoku_make = true;
        direct_hansoku_target = event.target;
        break;

      case 'START_OSAEKOMI':
        active_osaekomi = event.target;
        if (event.payload?.seconds !== undefined) {
          osaekomi_seconds = event.payload.seconds;
        }
        break;

      case 'STOP_OSAEKOMI':
        active_osaekomi = null;
        osaekomi_seconds = 0;
        break;

      case 'SWAP_OSAEKOMI':
        // Cambia el atleta retenedor manteniendo los segundos acumulados
        if (active_osaekomi) {
          active_osaekomi = active_osaekomi === 'WHITE' ? 'BLUE' : 'WHITE';
        }
        break;

      case 'START_CLOCK':
        is_clock_running = true;
        break;

      case 'STOP_CLOCK':
        is_clock_running = false;
        break;

      default:
        break;
    }
  }

  const is_mathematical_victory = winner !== null;

  return {
    white_score,
    blue_score,
    is_clock_running,
    active_osaekomi,
    osaekomi_seconds,
    winner,
    win_reason,
    is_mathematical_victory,
    has_direct_hansoku_make,
    direct_hansoku_target,
  };
}

/**
 * Determina el puntaje asignable según los segundos de Osaekomi (Regla oficial / catálogo configurable)
 * 5 a 9s   => Yuko
 * 10 a 19s => Waza-ari
 * 20s      => Ippon
 */
export function getOsaekomiAward(seconds: number, isGoldenScore = false): 'YUKO' | 'WAZA_ARI' | 'IPPON' | null {
  if (isGoldenScore) {
    // En Golden Score, a los 5 segundos de retención se alcanza Yuko y se acaba el combate
    return seconds >= 5 ? 'YUKO' : null;
  }

  if (seconds >= 20) return 'IPPON';
  if (seconds >= 10) return 'WAZA_ARI';
  if (seconds >= 5) return 'YUKO';
  return null;
}
