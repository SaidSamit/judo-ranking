// ==============================================================================
// MOTOR DE SORTEO Y GENERACIÓN DE LLAVES (BRACKET ENGINE)
// ==============================================================================
//
// REGLAS DE NEGOCIO IJF POR CANTIDAD DE COMPETIDORES:
// 1. N = 2 competidores:
//    Modalidad "Al mejor de 3" (Best of 3). Se generan hasta 3 combates entre ambos.
//    Se alterna judogi blanco/azul en cada combate por protocolo ético de Judo.
//
// 2. N in [3, 4, 5] competidores:
//    Modalidad "Todos contra todos" (Round Robin / Liga).
//    Implementado mediante el Algoritmo de Berger (Polygon Method):
//    - Garantiza que cada atleta enfrente a todos los demás exactamente una vez (N*(N-1)/2 combates).
//    - Minimiza la fatiga consecutiva distribuyendo los tiempos de descanso entre rondas.
//    - Equilibra de forma óptima el uso de judogis Blanco y Azul.
//
// 3. N >= 6 competidores:
//    Modalidad "Eliminación Simple" (Single Elimination).
//    - Calcula la potencia de 2 superior más cercana P in {8, 16, 32, 64}.
//    - Inyecta B = P - N "Byes" (pases directos) asignados rigurosamente a los mejores sembrados.
//    - Genera la estructura en árbol completa (Round 1, Cuartos, Semifinales, Final)
//      con enlaces de avance (next_match_id y next_match_slot) para alimentar la cola del tatami.
//
// ==============================================================================

export type BracketType = 'BEST_OF_3' | 'ROUND_ROBIN' | 'DOUBLE_POOL_5' | 'SINGLE_ELIMINATION' | 'UNCONTESTED';

/**
 * Traduce y formatea códigos técnicos de rondas (QF, SF, FINAL, RR_R1, BEST_OF_3_M1, etc.)
 * a nombres oficiales en español para la mesa de control, monitor de tatamis y colas de combate.
 */
export function formatRoundName(round: string | null | undefined): string {
  if (!round) return 'Ronda Oficial';

  const r = round.trim().toUpperCase();

  // Si ya tiene un nombre descriptivo completo, retornarlo
  if (round.startsWith('Al Mejor de 3') || round.startsWith('Todos contra Todos')) {
    return round;
  }

  // Doble Pool (5 Competidores IJF)
  if (r === 'DP_POOL_A_M1') return 'Pool A - Combate 1';
  if (r === 'DP_POOL_A_M2') return 'Pool A - Combate 2';
  if (r === 'DP_POOL_A_M3') return 'Pool A - Combate 3';
  if (r === 'DP_SEMI' || r === 'DP_POOL_B_M1') return 'Pool B - Semifinal Directa';
  if (r === 'DP_BRONZE') return 'Disputa por Bronce (3° Lugar)';
  if (r === 'DP_FINAL') return 'Gran Final (1° Lugar)';

  // Finales y Rondas Eliminatorias
  if (r === 'FINAL' || (r.startsWith('FINAL') && !r.includes('_'))) return 'Final';
  if (r === 'SF' || r === 'SEMIFINAL' || r === 'SEMI') return 'Semifinal';
  if (r === 'QF' || r === 'CUARTOS') return 'Cuartos de Final';
  if (r === 'R16' || r === 'OCTAVOS') return 'Octavos de Final';
  if (r === 'R32' || r === 'DIECISEISAVOS') return 'Dieciseisavos de Final';
  if (r === 'R64') return 'Treintaidosavos de Final';
  if (r === 'BRONZE' || r === 'BRONCE') return 'Disputa por Bronce';
  if (r === 'BRONZE_1' || r === 'BRONCE_1') return 'Disputa por Bronce A';
  if (r === 'BRONZE_2' || r === 'BRONCE_2') return 'Disputa por Bronce B';
  if (r === 'REPECHAGE' || r === 'REPECHAJE') return 'Repechaje';
  if (r === 'REPECHAGE_1' || r === 'REPECHAJE_1') return 'Repechaje 1';
  if (r === 'REPECHAGE_2' || r === 'REPECHAJE_2') return 'Repechaje 2';

  // Mejor de 3
  if (r === 'BEST_OF_3_M1') return 'Al Mejor de 3 - Combate 1';
  if (r === 'BEST_OF_3_M2') return 'Al Mejor de 3 - Combate 2';
  if (r === 'BEST_OF_3_M3_DECIDER' || r === 'BEST_OF_3_M3') return 'Al Mejor de 3 - Combate 3 (Desempate)';
  if (r.startsWith('BEST_OF_3')) {
    const matchM = r.match(/M(\d+)/);
    if (matchM) {
      return `Al Mejor de 3 - Combate ${matchM[1]}${r.includes('DECIDER') ? ' (Desempate)' : ''}`;
    }
    return 'Al Mejor de 3';
  }

  // Round Robin
  const rrMatch = r.match(/^RR_R(\d+)(?:_M(\d+))?$/);
  if (rrMatch) {
    const roundNum = rrMatch[1];
    const matchNum = rrMatch[2] ? ` - Combate ${rrMatch[2]}` : '';
    return `Todos contra Todos - Ronda ${roundNum}${matchNum}`;
  }
  if (r.startsWith('RR_R')) {
    return r.replace('RR_R', 'Todos contra Todos - Ronda ');
  }

  // Rondas compuestas: QF_M1, SF_M2, etc.
  if (r.startsWith('QF_M') || r.startsWith('QF-') || r.startsWith('QF ')) {
    const num = r.replace(/[^0-9]/g, '');
    return num ? `Cuartos de Final - Combate ${num}` : 'Cuartos de Final';
  }
  if (r.startsWith('SF_M') || r.startsWith('SF-') || r.startsWith('SF ')) {
    const num = r.replace(/[^0-9]/g, '');
    return num ? `Semifinal - Combate ${num}` : 'Semifinal';
  }

  // Limpieza genérica si contiene guiones bajos
  if (round.includes('_')) {
    return round
      .replace(/_/g, ' ')
      .replace(/\bRR\b/g, 'Todos contra Todos')
      .replace(/\bQF\b/g, 'Cuartos de Final')
      .replace(/\bSF\b/g, 'Semifinal')
      .replace(/\bFINAL\b/g, 'Final');
  }

  return round;
}

export interface Competitor {
  id: string; // UUID del atleta o registration_id
  name: string; // Nombre completo (ej: "Carlos Muñoz")
  club_name?: string; // Club de procedencia
  seed?: number; // Preclasificación / ranking (1 = mejor)
  weight?: number;
}

export interface GenerateBracketOptions {
  organization_id: string;
  tournament_id: string;
  category_id: string;
  category_name?: string;
  tatami_number: number;
  match_duration_seconds?: number;
  start_match_number?: number; // Número inicial para la cola de combates del tatami
  preferred_format_5?: 'ROUND_ROBIN' | 'DOUBLE_POOL_5';
}

export interface GeneratedMatch {
  id: string; // UUID v4
  organization_id: string;
  tournament_id: string;
  category_id: string;
  tatami_number: number;
  match_number: number;
  round: string; // 'BEST_OF_3_M1', 'RR_R1_M1', 'QF', 'SF', 'FINAL', etc.
  round_name: string;
  white_athlete_id: string | null;
  blue_athlete_id: string | null;
  white_athlete_name: string;
  blue_athlete_name: string;
  white_club_name?: string;
  blue_club_name?: string;
  winner_id: string | null;
  status: 'SCHEDULED' | 'PENDING' | 'FINISHED' | 'WALKOVER';
  white_score: { ippon: number; wazaari: number; yuko: number; shido: number };
  blue_score: { ippon: number; wazaari: number; yuko: number; shido: number };
  current_match_time_seconds: number;
  is_golden_score: boolean;
  is_bye?: boolean;
  // Enlaces de progresión para la llave
  next_match_id?: string | null;
  next_match_slot?: 'WHITE' | 'BLUE' | null;
}

export interface BracketResult {
  bracket_type: BracketType;
  competitor_count: number;
  total_matches: number;
  matches: GeneratedMatch[];
  summary: {
    description: string;
    rounds_count: number;
    byes_count: number;
    power_of_two?: number;
  };
}

/**
 * Generador de UUID v4 compatible con servidor y navegador.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==============================================================================
// 0. MODALIDAD: UN SOLO COMPETIDOR (UNCONTESTED / SIN CONTENDOR) - N = 1
// ==============================================================================

function generateUncontested(
  competitors: Competitor[],
  opts: GenerateBracketOptions
): BracketResult {
  const c1 = competitors[0];
  const startNum = opts.start_match_number || 1;
  const match: GeneratedMatch = {
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum,
    round: 'FINAL',
    round_name: 'Campeón Directo (Sin Contendor)',
    white_athlete_id: c1.id,
    blue_athlete_id: null,
    white_athlete_name: c1.name,
    blue_athlete_name: 'Sin Contendor',
    white_club_name: c1.club_name,
    blue_club_name: '—',
    winner_id: c1.id,
    status: 'FINISHED',
    white_score: { ippon: 1, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  };

  return {
    bracket_type: 'UNCONTESTED',
    competitor_count: 1,
    total_matches: 1,
    matches: [match],
    summary: {
      description: '1 competidor en la categoría: Campeón declarado automáticamente sin contendor.',
      rounds_count: 1,
      byes_count: 0,
    },
  };
}

// ==============================================================================
// 1. MODALIDAD: AL MEJOR DE 3 (BEST OF 3) - N = 2
// ==============================================================================

function generateBestOf3(
  competitors: Competitor[],
  opts: GenerateBracketOptions
): BracketResult {
  const [c1, c2] = competitors;
  const startNum = opts.start_match_number || 1;
  const matches: GeneratedMatch[] = [];

  // Combate 1: C1 (Blanco) vs C2 (Azul)
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum,
    round: 'BEST_OF_3_M1',
    round_name: 'Al Mejor de 3 - Combate 1',
    white_athlete_id: c1.id,
    blue_athlete_id: c2.id,
    white_athlete_name: c1.name,
    blue_athlete_name: c2.name,
    white_club_name: c1.club_name,
    blue_club_name: c2.club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 2: C1 (Blanco) vs C2 (Azul) - Se mantienen siempre los mismos colores
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 1,
    round: 'BEST_OF_3_M2',
    round_name: 'Al Mejor de 3 - Combate 2',
    white_athlete_id: c1.id,
    blue_athlete_id: c2.id,
    white_athlete_name: c1.name,
    blue_athlete_name: c2.name,
    white_club_name: c1.club_name,
    blue_club_name: c2.club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 3: C1 (Blanco) vs C2 (Azul) - Desempate (mismos colores)
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 2,
    round: 'BEST_OF_3_M3_DECIDER',
    round_name: 'Al Mejor de 3 - Combate 3 (Desempate)',
    white_athlete_id: c1.id,
    blue_athlete_id: c2.id,
    white_athlete_name: c1.name,
    blue_athlete_name: c2.name,
    white_club_name: c1.club_name,
    blue_club_name: c2.club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  return {
    bracket_type: 'BEST_OF_3',
    competitor_count: 2,
    total_matches: matches.length,
    matches,
    summary: {
      description: 'Al Mejor de 3: hasta 3 combates programados.',
      rounds_count: 3,
      byes_count: 0,
    },
  };
}

// ==============================================================================
// 2. MODALIDAD: ROUND ROBIN (SISTEMA DE BERGER / POLÍGONO) - N in [3, 4, 5]
// ==============================================================================

function generateRoundRobin(
  competitors: Competitor[],
  opts: GenerateBracketOptions
): BracketResult {
  const n = competitors.length;
  // Si n es impar, agregamos un competidor ficticio "BYE"
  const isOdd = n % 2 !== 0;
  const list: (Competitor | null)[] = [...competitors];
  if (isOdd) {
    list.push(null); // Dummy Bye
  }

  const m = list.length; // Siempre par (4 o 6)
  const totalRounds = m - 1;
  const half = m / 2;
  let currentMatchNum = opts.start_match_number || 1;
  const matches: GeneratedMatch[] = [];

  // Copia de los elementos móviles (posiciones 1 a m-1)
  const rotating = list.slice(1);

  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    const roundNumber = roundIdx + 1;
    // Reconstruir lista actual: fijo en pos 0 + elementos rotados
    const currentList: (Competitor | null)[] = [list[0], ...rotating];

    for (let i = 0; i < half; i++) {
      const compA = currentList[i];
      const compB = currentList[m - 1 - i];

      // Si alguno es el competidor fantasma (BYE), esa pareja es una ronda de descanso
      if (!compA || !compB) continue;

      // Alternancia de Blanco y Azul según ronda y paridad para equilibrio de judogi
      let white = compA;
      let blue = compB;
      if (i === 0) {
        if (roundIdx % 2 !== 0) {
          white = compB;
          blue = compA;
        }
      } else {
        if ((i + roundIdx) % 2 !== 0) {
          white = compB;
          blue = compA;
        }
      }

      matches.push({
        id: generateUUID(),
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: `RR_R${roundNumber}`,
        round_name: `Todos contra Todos - Ronda ${roundNumber}`,
        white_athlete_id: white.id,
        blue_athlete_id: blue.id,
        white_athlete_name: white.name,
        blue_athlete_name: blue.name,
        white_club_name: white.club_name,
        blue_club_name: blue.club_name,
        winner_id: null,
        status: 'SCHEDULED',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      });
    }

    // Rotación circular en el sentido del reloj (último pasa a primero de los móviles)
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return {
    bracket_type: 'ROUND_ROBIN',
    competitor_count: n,
    total_matches: matches.length,
    matches,
    summary: {
      description: `Modalidad Round Robin (Todos contra todos): ${matches.length} cruces organizados en ${totalRounds}.`,
      rounds_count: totalRounds,
      byes_count: isOdd ? 1 : 0,
    },
  };
}

// ==============================================================================
// 2.1 MODALIDAD: DOBLE POOL IJF - N = 5 (3 EN POOL A + 2 EN POOL B CON FASE FINAL)
// ==============================================================================

function generateDoublePool5(
  competitors: Competitor[],
  opts: GenerateBracketOptions
): BracketResult {
  const startNum = opts.start_match_number || 1;

  // Sembrado IJF:
  // Si tienen seed (1 a 5), se ordenan por seed:
  // - Pool A (3 atletas): Semillas impares #1, #3, #5
  // - Pool B (2 atletas): Semillas pares #2, #4
  // Si no tienen seed, se distribuyen aleatoriamente
  const hasSeeds = competitors.some((c) => typeof c.seed === 'number' && c.seed > 0);
  let sorted: Competitor[];
  if (hasSeeds) {
    sorted = [...competitors].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  } else {
    sorted = [...competitors].sort(() => Math.random() - 0.5);
  }

  const poolA: Competitor[] = [sorted[0], sorted[2], sorted[4]];
  const poolB: Competitor[] = [sorted[1], sorted[3]];

  const matches: GeneratedMatch[] = [];

  const bronzeMatchId = generateUUID();
  const finalMatchId = generateUUID();

  // Combate 1: Pool A - 1 vs 3
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum,
    round: 'DP_POOL_A_M1',
    round_name: 'Pool A - Combate 1',
    white_athlete_id: poolA[0].id,
    blue_athlete_id: poolA[1].id,
    white_athlete_name: poolA[0].name,
    blue_athlete_name: poolA[1].name,
    white_club_name: poolA[0].club_name,
    blue_club_name: poolA[1].club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 2: Pool B - Semifinal Directa (2 vs 4)
  // El ganador pasa a la Gran Final (Combate 6 - Blue)
  // El perdedor pasa a la Disputa de Bronce (Combate 5 - Blue)
  const semiMatchId = generateUUID();
  matches.push({
    id: semiMatchId,
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 1,
    round: 'DP_SEMI',
    round_name: 'Pool B - Semifinal Directa',
    white_athlete_id: poolB[0].id,
    blue_athlete_id: poolB[1].id,
    white_athlete_name: poolB[0].name,
    blue_athlete_name: poolB[1].name,
    white_club_name: poolB[0].club_name,
    blue_club_name: poolB[1].club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
    next_match_id: finalMatchId,
    next_match_slot: 'BLUE',
  });

  // Combate 3: Pool A - 1 vs 5
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 2,
    round: 'DP_POOL_A_M2',
    round_name: 'Pool A - Combate 2',
    white_athlete_id: poolA[0].id,
    blue_athlete_id: poolA[2].id,
    white_athlete_name: poolA[0].name,
    blue_athlete_name: poolA[2].name,
    white_club_name: poolA[0].club_name,
    blue_club_name: poolA[2].club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 4: Pool A - 3 vs 5
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 3,
    round: 'DP_POOL_A_M3',
    round_name: 'Pool A - Combate 3',
    white_athlete_id: poolA[1].id,
    blue_athlete_id: poolA[2].id,
    white_athlete_name: poolA[1].name,
    blue_athlete_name: poolA[2].name,
    white_club_name: poolA[1].club_name,
    blue_club_name: poolA[2].club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 5: Disputa por Bronce (3° Lugar)
  matches.push({
    id: bronzeMatchId,
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 4,
    round: 'DP_BRONZE',
    round_name: 'Disputa por Bronce (3° Lugar)',
    white_athlete_id: null,
    blue_athlete_id: null,
    white_athlete_name: 'Por definir',
    blue_athlete_name: 'Por definir',
    winner_id: null,
    status: 'PENDING',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 6: Gran Final (1° y 2° Lugar)
  matches.push({
    id: finalMatchId,
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 5,
    round: 'DP_FINAL',
    round_name: 'Gran Final (1° Lugar)',
    white_athlete_id: null,
    blue_athlete_id: null,
    white_athlete_name: 'Por definir',
    blue_athlete_name: 'Por definir',
    winner_id: null,
    status: 'PENDING',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  return {
    bracket_type: 'DOUBLE_POOL_5',
    competitor_count: 5,
    total_matches: matches.length,
    matches,
    summary: {
      description: 'Modalidad Pool Doble: Pool A (Round Robin de 3) y Pool B (Semifinal directa) con cruce a Final y Bronce.',
      rounds_count: 4,
      byes_count: 0,
    },
  };
}

// ==============================================================================
// 3. MODALIDAD: ELIMINACIÓN SIMPLE CON BYES - N >= 6
// ==============================================================================

/**
 * Calcula el orden estándar de sembrado en un cuadro de tamaño P (potencia de 2).
 * Ejemplo para P=8: [1, 8, 5, 4, 3, 6, 7, 2]
 */
function getStandardSeedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const nextOrder: number[] = [];
    const targetSum = order.length * 2 + 1;
    for (const seed of order) {
      nextOrder.push(seed);
      nextOrder.push(targetSum - seed);
    }
    order = nextOrder;
  }
  return order;
}

/**
 * Retorna el nombre técnico de la ronda según la distancia a la Final.
 */
function getRoundLabel(roundRemaining: number): { code: string; name: string } {
  switch (roundRemaining) {
    case 1:
      return { code: 'FINAL', name: 'Final' };
    case 2:
      return { code: 'SF', name: 'Semifinal' };
    case 3:
      return { code: 'QF', name: 'Cuartos de Final' };
    case 4:
      return { code: 'R16', name: 'Octavos de Final' };
    case 5:
      return { code: 'R32', name: 'Dieciseisavos de Final' };
    default:
      return { code: `R_${roundRemaining}`, name: `Ronda Preliminar` };
  }
}

function generateSingleElimination(
  competitors: Competitor[],
  opts: GenerateBracketOptions
): BracketResult {
  const n = competitors.length;
  // 1. Encontrar la potencia de 2 superior más cercana
  const p = Math.pow(2, Math.ceil(Math.log2(n)));
  const byesCount = p - n;
  const totalRounds = Math.log2(p);

  // Ordenar atletas por seed (si no tienen seed, mantener el orden de entrada)
  const sortedCompetitors = [...competitors].sort((a, b) => (a.seed || 999) - (b.seed || 999));

  // Asignar semillas del 1 al N
  const seededAthletes: { [seed: number]: Competitor } = {};
  sortedCompetitors.forEach((c, idx) => {
    seededAthletes[idx + 1] = c;
  });

  // Orden de los slots en el cuadro de tamaño P
  const bracketSlots = getStandardSeedOrder(p);

  // Mapear cada slot a su competidor o a un BYE
  // Los primeros `byesCount` sembrados (1, 2, ... byesCount) no reciben BYE ellos mismos,
  // sino que sus RIVALES reciben el BYE. Es decir, los Byes se asignan a las posiciones vacías (semillas > N).
  const slotCompetitors: (Competitor | null)[] = bracketSlots.map((seedNum) => {
    if (seedNum <= n) {
      return seededAthletes[seedNum];
    }
    return null; // Slot libre = BYE
  });

  let currentMatchNum = opts.start_match_number || 1;
  const matchesByRound: GeneratedMatch[][] = [];
  const allMatchesMap = new Map<string, GeneratedMatch>();

  // Construir la estructura de rondas desde la primera hasta la Final
  let currentRoundSlots: { athlete: Competitor | null; fromMatchId?: string; fromSlot?: 'WHITE' | 'BLUE' }[] =
    slotCompetitors.map((c) => ({ athlete: c }));

  for (let r = 0; r < totalRounds; r++) {
    const roundRemaining = totalRounds - r;
    const { code, name } = getRoundLabel(roundRemaining);
    const roundMatches: GeneratedMatch[] = [];
    const nextRoundSlots: { athlete: Competitor | null; fromMatchId?: string; fromSlot?: 'WHITE' | 'BLUE' }[] = [];

    const numMatchesInRound = currentRoundSlots.length / 2;

    for (let m = 0; m < numMatchesInRound; m++) {
      const slotA = currentRoundSlots[m * 2];
      const slotB = currentRoundSlots[m * 2 + 1];

      // Caso Ronda 1 con BYE:
      // Si uno de los dos es BYE (null) en la primera ronda, se representa en la misma línea
      // con el competidor opuesto marcado como '-' y el atleta real avanza al cruce siguiente.
      if (r === 0 && (!slotA.athlete || !slotB.athlete)) {
        const advancingAthlete = slotA.athlete || slotB.athlete;
        const matchId = generateUUID();
        const isWhite = !!slotA.athlete;

        const byeMatch: GeneratedMatch = {
          id: matchId,
          organization_id: opts.organization_id,
          tournament_id: opts.tournament_id,
          category_id: opts.category_id,
          tatami_number: opts.tatami_number,
          match_number: currentMatchNum++,
          round: code,
          round_name: `${name} - Combate #${m + 1}`,
          white_athlete_id: isWhite && advancingAthlete ? advancingAthlete.id : null,
          blue_athlete_id: !isWhite && advancingAthlete ? advancingAthlete.id : null,
          white_athlete_name: isWhite && advancingAthlete ? advancingAthlete.name : '—',
          blue_athlete_name: !isWhite && advancingAthlete ? advancingAthlete.name : '—',
          white_club_name: isWhite ? advancingAthlete?.club_name : undefined,
          blue_club_name: !isWhite ? advancingAthlete?.club_name : undefined,
          winner_id: advancingAthlete ? advancingAthlete.id : null,
          status: 'FINISHED',
          white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
          blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
          current_match_time_seconds: 0,
          is_golden_score: false,
          is_bye: true,
        };

        roundMatches.push(byeMatch);
        allMatchesMap.set(matchId, byeMatch);

        // Pasa automáticamente a la siguiente ronda guardando fromMatchId
        nextRoundSlots.push({
          athlete: advancingAthlete,
          fromMatchId: matchId,
        });
        continue;
      }

      const matchId = generateUUID();
      const isInitialReady = !!slotA.athlete && !!slotB.athlete;

      const newMatch: GeneratedMatch = {
        id: matchId,
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: code,
        round_name: `${name} - Combate #${m + 1}`,
        white_athlete_id: slotA.athlete ? slotA.athlete.id : null,
        blue_athlete_id: slotB.athlete ? slotB.athlete.id : null,
        white_athlete_name: slotA.athlete ? slotA.athlete.name : 'Por definir',
        blue_athlete_name: slotB.athlete ? slotB.athlete.name : 'Por definir',
        white_club_name: slotA.athlete?.club_name,
        blue_club_name: slotB.athlete?.club_name,
        winner_id: null,
        status: isInitialReady ? 'SCHEDULED' : 'PENDING',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      };

      roundMatches.push(newMatch);
      allMatchesMap.set(matchId, newMatch);

      // Si este slot proviene del ganador de un combate anterior, enlazarlo inmediatamente
      if (slotA.fromMatchId && allMatchesMap.has(slotA.fromMatchId)) {
        const prevMatchA = allMatchesMap.get(slotA.fromMatchId)!;
        prevMatchA.next_match_id = matchId;
        prevMatchA.next_match_slot = 'WHITE';
      }
      if (slotB.fromMatchId && allMatchesMap.has(slotB.fromMatchId)) {
        const prevMatchB = allMatchesMap.get(slotB.fromMatchId)!;
        prevMatchB.next_match_id = matchId;
        prevMatchB.next_match_slot = 'BLUE';
      }

      // El ganador de este combate alimentará el siguiente slot de la siguiente ronda
      nextRoundSlots.push({
        athlete: null,
        fromMatchId: matchId,
      });
    }

    if (roundMatches.length > 0) {
      matchesByRound.push(roundMatches);
    }
    currentRoundSlots = nextRoundSlots;
  }

  // ============================================================================
  // REGLAMENTO OLÍMPICO IJF: REPECHAJE Y DOBLE BRONCE (PARA N >= 6)
  // ============================================================================
  // En llaves de 6 o más competidores:
  // - Los perdedores de Cuartos de Final (QF) disputan el Repechaje:
  //   * REPECHAGE_1: Perdedor QF 1 vs Perdedor QF 2
  //   * REPECHAGE_2: Perdedor QF 3 vs Perdedor QF 4
  // - Los perdedores de Semifinales (SF) cruzan de rama para evitar revanchas inmediatas:
  //   * BRONZE_1: Perdedor SF 2 (Rama B) vs Ganador REPECHAGE_1 (Rama A)
  //   * BRONZE_2: Perdedor SF 1 (Rama A) vs Ganador REPECHAGE_2 (Rama B)
  // De esta forma se proclaman DOS terceros lugares (Doble Bronce) sin repetir cruces previos.
  if (n >= 6) {
    const qfMatches = matchesByRound.find(
      (roundList) => roundList.length > 0 && roundList[0].round === 'QF'
    );
    const sfMatches = matchesByRound.find(
      (roundList) => roundList.length > 0 && roundList[0].round === 'SF'
    );

    if (qfMatches && qfMatches.length >= 2) {
      // 1. REPECHAJE 1: Entre perdedores de QF 1 y QF 2 (Rama A)
      const rep1Id = generateUUID();
      const rep1Match: GeneratedMatch = {
        id: rep1Id,
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: 'REPECHAGE_1',
        round_name: 'Repechaje 1 (Cuadro Superior)',
        white_athlete_id: null,
        blue_athlete_id: null,
        white_athlete_name: 'Perdedor Cuartos #1',
        blue_athlete_name: 'Perdedor Cuartos #2',
        winner_id: null,
        status: 'PENDING',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      };

      // 2. REPECHAJE 2: Entre perdedores de QF 3 y QF 4 (Rama B - si existen)
      const rep2Id = generateUUID();
      const rep2Match: GeneratedMatch = {
        id: rep2Id,
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: 'REPECHAGE_2',
        round_name: 'Repechaje 2 (Cuadro Inferior)',
        white_athlete_id: null,
        blue_athlete_id: null,
        white_athlete_name: qfMatches.length >= 3 ? 'Perdedor Cuartos #3' : 'Perdedor Cuartos',
        blue_athlete_name: qfMatches.length >= 4 ? 'Perdedor Cuartos #4' : 'Por definir',
        winner_id: null,
        status: 'PENDING',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      };

      // 3. COMBATE POR BRONCE 1: Perdedor SF 2 vs Ganador REPECHAGE 1 (Cruce A <-> B)
      const bronze1Id = generateUUID();
      const bronze1Match: GeneratedMatch = {
        id: bronze1Id,
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: 'BRONZE_1',
        round_name: 'Disputa por Bronce A (3° Lugar)',
        white_athlete_id: null,
        blue_athlete_id: null,
        white_athlete_name: 'Perdedor Semifinal #2',
        blue_athlete_name: 'Ganador Repechaje 1',
        winner_id: null,
        status: 'PENDING',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      };

      // 4. COMBATE POR BRONCE 2: Perdedor SF 1 vs Ganador REPECHAGE 2 (Cruce B <-> A)
      const bronze2Id = generateUUID();
      const bronze2Match: GeneratedMatch = {
        id: bronze2Id,
        organization_id: opts.organization_id,
        tournament_id: opts.tournament_id,
        category_id: opts.category_id,
        tatami_number: opts.tatami_number,
        match_number: currentMatchNum++,
        round: 'BRONZE_2',
        round_name: 'Disputa por Bronce B (3° Lugar)',
        white_athlete_id: null,
        blue_athlete_id: null,
        white_athlete_name: 'Perdedor Semifinal #1',
        blue_athlete_name: 'Ganador Repechaje 2',
        winner_id: null,
        status: 'PENDING',
        white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        current_match_time_seconds: 0,
        is_golden_score: false,
      };

      // Enlazar ganador de repechaje hacia el bronce respectivo
      rep1Match.next_match_id = bronze1Id;
      rep1Match.next_match_slot = 'BLUE';

      rep2Match.next_match_id = bronze2Id;
      rep2Match.next_match_slot = 'BLUE';

      allMatchesMap.set(rep1Id, rep1Match);
      allMatchesMap.set(rep2Id, rep2Match);
      allMatchesMap.set(bronze1Id, bronze1Match);
      allMatchesMap.set(bronze2Id, bronze2Match);

      matchesByRound.push([rep1Match, rep2Match]);
      matchesByRound.push([bronze1Match, bronze2Match]);
    }
  }

  // Aplanar todos los combates reales en orden cronológico de cola
  const flattenedMatches = matchesByRound.flat();

  return {
    bracket_type: 'SINGLE_ELIMINATION',
    competitor_count: n,
    total_matches: flattenedMatches.length,
    matches: flattenedMatches,
    summary: {
      description: `Eliminación Simple IJF (${p} slots, ${byesCount} Byes) con Repechaje y Doble Bronce.`,
      rounds_count: totalRounds,
      byes_count: byesCount,
      power_of_two: p,
    },
  };
}

// ==============================================================================
// FUNCIÓN PRINCIPAL EXPORTADA: GENERAR LLAVE SEGÚN REGLAS DE NEGOCIO
// ==============================================================================

/**
 * Motor Dinámico de Sorteo:
 * Evalúa el número exacto de competidores N y delega a la modalidad correspondiente:
 * - N = 2: Best of 3
 * - N in [3, 4, 5]: Round Robin (Berger)
 * - N >= 6: Eliminación Simple con Byes hacia potencia de 2
 */
export function generateCategoryBracket(
  competitors: Competitor[],
  options: GenerateBracketOptions
): BracketResult {
  if (!competitors || competitors.length < 1) {
    throw new Error('Se requiere al menos 1 competidor para generar la categoría.');
  }

  const count = competitors.length;
  let result: BracketResult;

  if (count === 1) {
    result = generateUncontested(competitors, options);
  } else if (count === 2) {
    result = generateBestOf3(competitors, options);
  } else if (count >= 3 && count <= 4) {
    result = generateRoundRobin(competitors, options);
  } else if (count === 5) {
    if (options.preferred_format_5 === 'ROUND_ROBIN') {
      result = generateRoundRobin(competitors, options);
    } else {
      result = generateDoublePool5(competitors, options);
    }
  } else {
    result = generateSingleElimination(competitors, options);
  }

  // Optimizar la secuencia interna de la categoría con la regla de descanso IJF
  if (result.matches && result.matches.length > 1) {
    result.matches = sequenceTatamiMatches(result.matches, options.start_match_number || 1);
  }

  return result;
}

/**
 * Estima la cantidad de combates que producirá una categoría según la cantidad de competidores pesados.
 */
export function estimateCategoryMatchesCount(
  athleteCount: number,
  preferredFormat5?: 'ROUND_ROBIN' | 'DOUBLE_POOL_5'
): number {
  if (athleteCount <= 1) return 0;
  if (athleteCount === 2) return 3; // Best of 3
  if (athleteCount === 3) return 3; // Round Robin (3 cruces)
  if (athleteCount === 4) return 6; // Round Robin (6 cruces)
  if (athleteCount === 5) return preferredFormat5 === 'ROUND_ROBIN' ? 10 : 6;
  return athleteCount - 1; // Eliminación simple
}

/**
 * REGLA OFICIAL IJF (SECCIÓN 7.2 - TIEMPOS DE DESCANSO):
 * Secuenciador Anticonsecutivo de Tatami.
 * Dado un conjunto de combates que se disputarán en un tatami (pueden pertenecer a una
 * o múltiples categorías/rondas), reordena los combates de manera que:
 * 1. NUNCA se llame al mismo judoka en dos combates consecutivos a menos que sea
 *    matemáticamente imposible (ej: categoría aislada de 2 o 4 participantes sin otros cruces).
 * 2. Si hay múltiples categorías o fases en el tatami, se intercalan ordenadamente
 *    (ej: Cat A R1 -> Cat B R1 -> Cat A R2 -> Cat B R2) permitiendo un descanso natural de 10-20 min.
 * 3. Conserva el orden de avance lógico (rondas iniciales antes que semifinales o finales).
 * 4. Reasigna los números de combate correlativamente (1, 2, 3...) sin dejar huecos.
 */
export function sequenceTatamiMatches(
  matches: GeneratedMatch[],
  startMatchNumber: number = 1
): GeneratedMatch[] {
  if (!matches || matches.length <= 1) {
    return matches.map((m, idx) => ({ ...m, match_number: startMatchNumber + idx }));
  }

  function getRoundWeight(round: string): number {
    const r = (round || '').toUpperCase();
    if (r.startsWith('RR_R1') || r.startsWith('R64') || r.startsWith('R32')) return 1;
    if (r.startsWith('RR_R2') || r.startsWith('R16')) return 2;
    if (r.startsWith('RR_R3') || r.startsWith('QF')) return 3;
    if (r.startsWith('REPECHAGE')) return 4;
    if (r.startsWith('RR_R4') || r.startsWith('SF')) return 5;
    if (r.startsWith('BRONZE')) return 6;
    if (r.startsWith('RR_R5') || r.startsWith('FINAL') || r.includes('M3_DECIDER')) return 7;
    return 3;
  }

  const remaining = [...matches];
  const ordered: GeneratedMatch[] = [];
  const lastFoughtAt = new Map<string, number>();

  let currentIndex = 0;

  while (remaining.length > 0) {
    const prevMatch = ordered.length > 0 ? ordered[ordered.length - 1] : null;
    const prevAthletes = new Set<string>();
    if (prevMatch) {
      if (prevMatch.white_athlete_id) prevAthletes.add(prevMatch.white_athlete_id);
      if (prevMatch.blue_athlete_id) prevAthletes.add(prevMatch.blue_athlete_id);
    }

    // Candidatos que NO comparten ningún atleta con el combate inmediatamente anterior
    const nonConsecutiveCandidates = remaining.filter((m) => {
      const whiteInPrev = m.white_athlete_id ? prevAthletes.has(m.white_athlete_id) : false;
      const blueInPrev = m.blue_athlete_id ? prevAthletes.has(m.blue_athlete_id) : false;
      return !whiteInPrev && !blueInPrev;
    });

    const candidates = nonConsecutiveCandidates.length > 0 ? nonConsecutiveCandidates : remaining;

    // Seleccionar el mejor candidato:
    // 1. Menor peso de ronda (respetar la progresión del torneo)
    // 2. Si el combate anterior era de la misma categoría, dar prioridad a una categoría diferente
    // 3. Mayor tiempo de descanso acumulado para sus atletas
    candidates.sort((a, b) => {
      const weightA = getRoundWeight(a.round);
      const weightB = getRoundWeight(b.round);
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      if (prevMatch) {
        const diffCatA = a.category_id !== prevMatch.category_id ? 0 : 1;
        const diffCatB = b.category_id !== prevMatch.category_id ? 0 : 1;
        if (diffCatA !== diffCatB) {
          return diffCatA - diffCatB;
        }
      }

      const lastA1 = a.white_athlete_id ? (lastFoughtAt.get(a.white_athlete_id) ?? -10) : -10;
      const lastA2 = a.blue_athlete_id ? (lastFoughtAt.get(a.blue_athlete_id) ?? -10) : -10;
      const minRestA = Math.max(lastA1, lastA2);

      const lastB1 = b.white_athlete_id ? (lastFoughtAt.get(b.white_athlete_id) ?? -10) : -10;
      const lastB2 = b.blue_athlete_id ? (lastFoughtAt.get(b.blue_athlete_id) ?? -10) : -10;
      const minRestB = Math.max(lastB1, lastB2);

      return minRestA - minRestB;
    });

    const chosen = candidates[0];
    const chosenIndex = remaining.indexOf(chosen);
    remaining.splice(chosenIndex, 1);

    ordered.push({
      ...chosen,
      match_number: startMatchNumber + currentIndex,
    });

    if (chosen.white_athlete_id) lastFoughtAt.set(chosen.white_athlete_id, currentIndex);
    if (chosen.blue_athlete_id) lastFoughtAt.set(chosen.blue_athlete_id, currentIndex);

    currentIndex++;
  }

  return ordered;
}
