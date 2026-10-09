// ==============================================================================
// VOCABULARIO Y TIPOS FORMALES DE EVENT SOURCING (REGLAMENTO IJF)
// ==============================================================================

export type CombatantColor = 'WHITE' | 'BLUE';

export type MatchAction =
  // Puntajes (IJF)
  | 'ADD_IPPON'
  | 'DELETE_IPPON'
  | 'ADD_WAZA_ARI'
  | 'DELETE_WAZA_ARI'
  | 'ADD_YUKO'
  | 'DELETE_YUKO'
  // Penalizaciones
  | 'ADD_SHIDO'
  | 'DELETE_SHIDO'
  | 'ADD_HANSOKU_MAKE'
  | 'DELETE_HANSOKU_MAKE'
  // Retenciones (Osaekomi)
  | 'START_OSAEKOMI'
  | 'STOP_OSAEKOMI'
  | 'SWAP_OSAEKOMI'
  // Control de Reloj
  | 'START_CLOCK'   // Hajime!
  | 'STOP_CLOCK'    // Mate!
  | 'RESET_CLOCK'
  // Ciclo de Vida del Combate
  | 'DECLARATION_FINISH';

export interface MatchEvent {
  id: string;
  match_id: string;
  organization_id?: string;
  sequence_number: number;
  action: MatchAction;
  target: CombatantColor | null;
  match_time: string;           // Formato "MM:SS" (ej: "03:10")
  match_time_seconds: number;   // Tiempo transcurrido en segundos
  is_undone: boolean;           // true si fue anulado por SHIFT + KEY
  undone_by_event_id?: string | null;
  payload?: Record<string, any>;
  created_at: string;
  synced_to_cloud?: boolean;    // Flag para cola de sincronización offline
}

export interface ScoreState {
  ippon: number;
  wazaari: number;
  yuko: number;
  shido: number;
  has_hansoku_make: boolean;              // true si tiene directo o indirecto
  has_hansoku_make_direct: boolean;       // true si fue expulsión directa intencional
  has_hansoku_make_indirect: boolean;     // true si fue por acumulación de 3 shidos
}

export interface MatchProjection {
  white_score: ScoreState;
  blue_score: ScoreState;
  is_clock_running: boolean;
  active_osaekomi: CombatantColor | null;
  osaekomi_seconds: number;
  winner: CombatantColor | null;
  win_reason: string | null;
  is_mathematical_victory: boolean;
  has_direct_hansoku_make: boolean;       // Requiere tipificación (Técnico vs Disciplinario)
  direct_hansoku_target: CombatantColor | null;
}
