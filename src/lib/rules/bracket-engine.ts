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

export type BracketType = 'BEST_OF_3' | 'ROUND_ROBIN' | 'SINGLE_ELIMINATION';

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
  status: 'SCHEDULED' | 'PENDING';
  white_score: { ippon: 0; wazaari: 0; yuko: 0; shido: 0 };
  blue_score: { ippon: 0; wazaari: 0; yuko: 0; shido: 0 };
  current_match_time_seconds: 0;
  is_golden_score: false;
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
    round_name: 'Mejor de 3 - Combate 1',
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

  // Combate 2: C2 (Blanco) vs C1 (Azul) - Alternancia de Judogi
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 1,
    round: 'BEST_OF_3_M2',
    round_name: 'Mejor de 3 - Combate 2',
    white_athlete_id: c2.id,
    blue_athlete_id: c1.id,
    white_athlete_name: c2.name,
    blue_athlete_name: c1.name,
    white_club_name: c2.club_name,
    blue_club_name: c1.club_name,
    winner_id: null,
    status: 'SCHEDULED',
    white_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    blue_score: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
    current_match_time_seconds: 0,
    is_golden_score: false,
  });

  // Combate 3: C1 (Blanco) vs C2 (Azul) - Desempate condicional
  matches.push({
    id: generateUUID(),
    organization_id: opts.organization_id,
    tournament_id: opts.tournament_id,
    category_id: opts.category_id,
    tatami_number: opts.tatami_number,
    match_number: startNum + 2,
    round: 'BEST_OF_3_M3_DECIDER',
    round_name: 'Mejor de 3 - Combate 3 (Desempate)',
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
      description: 'Modalidad al Mejor de 3: hasta 3 combates programados con rotación de color.',
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
        round_name: `Round Robin - Ronda ${roundNumber}`,
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
      description: `Modalidad Round Robin (Berger): ${matches.length} cruces organizados en ${totalRounds} rondas con descanso balanceado.`,
      rounds_count: totalRounds,
      byes_count: isOdd ? 1 : 0,
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
      // Si uno de los dos es BYE (null) en la primera ronda, el competidor real avanza directo sin pelear
      if (r === 0 && (!slotA.athlete || !slotB.athlete)) {
        const advancingAthlete = slotA.athlete || slotB.athlete;
        // Pasa automáticamente a la siguiente ronda
        nextRoundSlots.push({
          athlete: advancingAthlete,
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
        round_name: `${name} - Llave #${m + 1}`,
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

  // Enlazar los `next_match_id` y `next_match_slot` entre rondas consecutivas
  for (let rIdx = 0; rIdx < matchesByRound.length - 1; rIdx++) {
    const currentRound = matchesByRound[rIdx];
    const nextRound = matchesByRound[rIdx + 1];

    currentRound.forEach((currMatch, idx) => {
      const nextMatchIdx = Math.floor(idx / 2);
      const isWhiteSlot = idx % 2 === 0;

      if (nextRound[nextMatchIdx]) {
        currMatch.next_match_id = nextRound[nextMatchIdx].id;
        currMatch.next_match_slot = isWhiteSlot ? 'WHITE' : 'BLUE';
      }
    });
  }

  // Aplanar todos los combates reales en orden cronológico de cola
  const flattenedMatches = matchesByRound.flat();

  return {
    bracket_type: 'SINGLE_ELIMINATION',
    competitor_count: n,
    total_matches: flattenedMatches.length,
    matches: flattenedMatches,
    summary: {
      description: `Eliminación Simple: árbol de tamaño ${p} con ${byesCount} Byes calculados hacia la Final.`,
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
  if (!competitors || competitors.length < 2) {
    throw new Error('Se requieren al menos 2 competidores para generar un sorteo de llaves válido.');
  }

  const count = competitors.length;

  if (count === 2) {
    return generateBestOf3(competitors, options);
  }

  if (count >= 3 && count <= 5) {
    return generateRoundRobin(competitors, options);
  }

  return generateSingleElimination(competitors, options);
}
