// ==============================================================================
// CATÁLOGO OFICIAL DE CATEGORÍAS IJF / FEJUCHILE POR EDAD, GÉNERO Y PESO
// ==============================================================================

export type AgeGroup =
  | 'Sub-7'
  | 'Sub-9'
  | 'Sub-11'
  | 'Sub-13'
  | 'Sub-15'
  | 'Cadetes (Sub-18)'
  | 'Junior (Sub-21)'
  | 'Senior'
  | 'Master';

export interface AgeDivisionInfo {
  ageGroup: AgeGroup;
  minAge: number;
  maxAge: number;
  matchDurationMinutes: number;
  weights: {
    M: string[];
    F: string[];
  };
}

export const JUDO_AGE_DIVISIONS: AgeDivisionInfo[] = [
  {
    ageGroup: 'Sub-7',
    minAge: 4,
    maxAge: 6,
    matchDurationMinutes: 1.5,
    weights: {
      M: ['-18kg', '-20kg', '-22kg', '-24kg', '-26kg', '+26kg'],
      F: ['-18kg', '-20kg', '-22kg', '-24kg', '-26kg', '+26kg'],
    },
  },
  {
    ageGroup: 'Sub-9',
    minAge: 7,
    maxAge: 8,
    matchDurationMinutes: 2,
    weights: {
      M: ['-22kg', '-24kg', '-26kg', '-28kg', '-31kg', '-34kg', '+34kg'],
      F: ['-22kg', '-24kg', '-26kg', '-28kg', '-31kg', '-34kg', '+34kg'],
    },
  },
  {
    ageGroup: 'Sub-11',
    minAge: 9,
    maxAge: 10,
    matchDurationMinutes: 2,
    weights: {
      M: ['-28kg', '-31kg', '-34kg', '-38kg', '-42kg', '-47kg', '-52kg', '+52kg'],
      F: ['-26kg', '-28kg', '-31kg', '-34kg', '-38kg', '-42kg', '-47kg', '+47kg'],
    },
  },
  {
    ageGroup: 'Sub-13',
    minAge: 11,
    maxAge: 12,
    matchDurationMinutes: 2,
    weights: {
      M: ['-28kg', '-31kg', '-34kg', '-38kg', '-42kg', '-47kg', '-52kg', '+52kg'],
      F: ['-28kg', '-31kg', '-34kg', '-38kg', '-42kg', '-47kg', '-52kg', '+52kg'],
    },
  },
  {
    ageGroup: 'Sub-15',
    minAge: 13,
    maxAge: 14,
    matchDurationMinutes: 3,
    weights: {
      M: ['-36kg', '-40kg', '-44kg', '-48kg', '-53kg', '-58kg', '-64kg', '+64kg'],
      F: ['-36kg', '-40kg', '-44kg', '-48kg', '-53kg', '-58kg', '-64kg', '+64kg'],
    },
  },
  {
    ageGroup: 'Cadetes (Sub-18)',
    minAge: 15,
    maxAge: 17,
    matchDurationMinutes: 4,
    weights: {
      M: ['-50kg', '-55kg', '-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '+90kg'],
      F: ['-40kg', '-44kg', '-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '+70kg'],
    },
  },
  {
    ageGroup: 'Junior (Sub-21)',
    minAge: 18,
    maxAge: 20,
    matchDurationMinutes: 4,
    weights: {
      M: ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'],
      F: ['-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '-78kg', '+78kg'],
    },
  },
  {
    ageGroup: 'Senior',
    minAge: 21,
    maxAge: 29,
    matchDurationMinutes: 4,
    weights: {
      M: ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'],
      F: ['-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '-78kg', '+78kg'],
    },
  },
  {
    ageGroup: 'Master',
    minAge: 30,
    maxAge: 99,
    matchDurationMinutes: 3,
    weights: {
      M: ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'],
      F: ['-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '-78kg', '+78kg'],
    },
  },
];

/**
 * Determina el grupo etario oficial según el año de nacimiento.
 */
export function getDivisionByBirthYear(
  birthYear: number,
  referenceYear: number = new Date().getFullYear()
): AgeDivisionInfo | null {
  if (!birthYear || isNaN(birthYear)) return null;
  const age = referenceYear - birthYear;

  for (const div of JUDO_AGE_DIVISIONS) {
    if (age >= div.minAge && age <= div.maxAge) {
      return div;
    }
  }

  // Menores de 6 años entran en Sub-7
  if (age < 7) {
    return JUDO_AGE_DIVISIONS[0];
  }

  return JUDO_AGE_DIVISIONS[JUDO_AGE_DIVISIONS.length - 1];
}

/**
 * Retorna la lista de pesos oficiales para una división de edad y género específicos.
 */
export function getWeightsForAgeDivision(ageGroup: string, gender: 'M' | 'F'): string[] {
  const normGroup = ageGroup.trim().toLowerCase();
  const div = JUDO_AGE_DIVISIONS.find((d) => d.ageGroup.toLowerCase() === normGroup) ||
    JUDO_AGE_DIVISIONS.find((d) => normGroup.includes(d.ageGroup.toLowerCase())) ||
    JUDO_AGE_DIVISIONS.find((d) => d.ageGroup === 'Senior');

  return div ? div.weights[gender] || div.weights.M : ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'];
}

/**
 * Retorna la duración de combate reglamentaria en minutos para una división de edad.
 */
export function getRecommendedDuration(ageGroup: string): number {
  const normGroup = ageGroup.trim().toLowerCase();
  const div = JUDO_AGE_DIVISIONS.find((d) => d.ageGroup.toLowerCase() === normGroup);
  return div?.matchDurationMinutes || 4;
}

/**
 * Retorna las categorías desplegables formateadas según el año de nacimiento y género.
 * Incluye automáticamente las categorías de edad superior permitidas por el reglamento
 * (ej: Sub-15 puede competir en Cadetes, Cadetes en Junior y Senior, Junior en Senior, Master en Senior).
 */
export function getAvailableCategoriesForAthlete(
  birthYear: number | undefined,
  gender: 'M' | 'F',
  referenceYear: number = new Date().getFullYear()
): { divisionName: string; categories: string[]; upperCategories: string[] } {
  if (!birthYear) {
    return { divisionName: '', categories: [], upperCategories: [] };
  }

  const division = getDivisionByBirthYear(birthYear, referenceYear);
  if (!division) {
    return { divisionName: '', categories: [], upperCategories: [] };
  }

  const genderLabel = gender === 'M' ? 'Masculino' : 'Femenino';
  const baseWeights = division.weights[gender];

  // 1. Categorías Propias de su División de Edad
  const categories = baseWeights.map(
    (weight) => `${division.ageGroup} ${genderLabel} ${weight}`
  );

  // 2. Categorías de Edad Superior Permitidas por el Reglamento de Judo
  const upperCategories: string[] = [];

  const addUpperDivision = (targetAgeGroup: AgeGroup) => {
    const targetDiv = JUDO_AGE_DIVISIONS.find((d) => d.ageGroup === targetAgeGroup);
    if (targetDiv) {
      targetDiv.weights[gender].forEach((w) => {
        upperCategories.push(`${targetDiv.ageGroup} ${genderLabel} ${w}`);
      });
    }
  };

  if (division.ageGroup === 'Sub-15') {
    // Sub-15 puede subir a Cadetes (Sub-18)
    addUpperDivision('Cadetes (Sub-18)');
  } else if (division.ageGroup === 'Cadetes (Sub-18)') {
    // Cadetes puede subir a Junior (Sub-21) y Senior
    addUpperDivision('Junior (Sub-21)');
    addUpperDivision('Senior');
  } else if (division.ageGroup === 'Junior (Sub-21)') {
    // Junior puede subir a Senior
    addUpperDivision('Senior');
  } else if (division.ageGroup === 'Master') {
    // Master puede competir en Senior
    addUpperDivision('Senior');
  }

  return {
    divisionName: division.ageGroup,
    categories,
    upperCategories,
  };
}

/**
 * Retorna todas las categorías posibles (para respaldo o importación CSV).
 */
export function getAllPossibleCategories(): string[] {
  const all: string[] = [];
  JUDO_AGE_DIVISIONS.forEach((div) => {
    div.weights.M.forEach((w) => all.push(`${div.ageGroup} Masculino ${w}`));
    div.weights.F.forEach((w) => all.push(`${div.ageGroup} Femenino ${w}`));
  });
  return all;
}

/**
 * Extrae el límite numérico de peso y si es categoría abierta superior (+) de un nombre de categoría.
 * Ej: "Cadetes (Sub-18) Masculino -60kg" -> { limit: 60, isPlus: false }
 * Ej: "Junior (Sub-21) Masculino +100kg" -> { limit: 100, isPlus: true }
 */
export function parseWeightLimitFromCategory(
  categoryName: string
): { limit: number; isPlus: boolean } | null {
  if (!categoryName) return null;
  const match = categoryName.match(/([+-])\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (!match) return null;
  const sign = match[1];
  const limit = parseFloat(match[2]);
  return {
    limit,
    isPlus: sign === '+',
  };
}

/**
 * Valida si un peso real se ajusta al límite reglamentario de la categoría.
 */
export function isWeightValidForCategory(
  weight: number,
  categoryName: string
): { valid: boolean; diff: number; limit: number; isPlus: boolean } {
  const parsed = parseWeightLimitFromCategory(categoryName);
  if (!parsed) {
    return { valid: true, diff: 0, limit: 0, isPlus: false };
  }

  if (parsed.isPlus) {
    const diff = weight - parsed.limit;
    return {
      valid: weight >= parsed.limit,
      diff: parseFloat(diff.toFixed(2)),
      limit: parsed.limit,
      isPlus: true,
    };
  } else {
    const diff = weight - parsed.limit;
    return {
      valid: weight <= parsed.limit,
      diff: parseFloat(diff.toFixed(2)),
      limit: parsed.limit,
      isPlus: false,
    };
  }
}

/**
 * Sugiere la categoría de peso superior inmediata dentro de la misma división etaria y género
 * si el atleta excede el peso de su categoría actual.
 */
export function getSuggestedUpperCategory(
  currentCategory: string,
  actualWeight: number
): string | null {
  for (const div of JUDO_AGE_DIVISIONS) {
    for (const gender of ['M', 'F'] as const) {
      const genderLabel = gender === 'M' ? 'Masculino' : 'Femenino';
      const prefix = `${div.ageGroup} ${genderLabel}`;

      if (currentCategory.includes(div.ageGroup) && currentCategory.includes(genderLabel)) {
        const weightList = div.weights[gender];
        for (const w of weightList) {
          const candidateName = `${div.ageGroup} ${genderLabel} ${w}`;
          if (candidateName === currentCategory) continue;

          const check = isWeightValidForCategory(actualWeight, candidateName);
          if (check.valid) {
            return candidateName;
          }
        }
      }
    }
  }
  return null;
}

// ==============================================================================
// MOTOR UNIFICADO DE ORDENAMIENTO CANÓNICO DE CATEGORÍAS (EDAD -> GÉNERO -> PESO)
// ==============================================================================

/**
 * Clasificador universal y flexible de grupo etario para categorías de Judo.
 * Implementa el Sistema Híbrido Inteligente (Opción 1):
 * 1. PRIORIDAD 1: Evalúa el texto del campo `name` (ej: 'Sub-9 Femenino -28kg').
 *    El nombre oficial explícito prevalece sobre cualquier valor desactualizado en la BD.
 * 2. PRIORIDAD 2 (Validación Biométrica): Si el nombre no indica edad (ej: 'Especial -35kg'),
 *    evalúa los años de nacimiento de los competidores inscritos (`athlete_birth_years`).
 * 3. PRIORIDAD 3: Evalúa el campo `age_group` guardado en BD.
 * 4. Retorna el rango numérico (1..10, 99), etiqueta legible y canonicalAgeGroup.
 */
export function resolveCategoryAgeRank(category: {
  name: string;
  age_group?: string | null;
  athlete_birth_years?: number[];
}): { rank: number; label: string; canonicalAgeGroup: string } {
  const name = (category.name || '').trim().toLowerCase();

  // 1. EVALUAR PRIMERO EL NOMBRE DE LA CATEGORÍA (MÁXIMA PRIORIDAD REGLAMENTARIA)
  if (name.includes('sub-7') || name.includes('sub 7') || name.includes('pre-infantil')) {
    return { rank: 1, label: 'Sub-7', canonicalAgeGroup: 'Sub-7' };
  }
  if (name.includes('sub-9') || name.includes('sub 9') || name.includes('sub9')) {
    return { rank: 2, label: 'Sub-9', canonicalAgeGroup: 'Sub-9' };
  }
  if (name.includes('sub-11') || name.includes('sub 11') || name.includes('infantil a')) {
    return { rank: 3, label: 'Sub-11', canonicalAgeGroup: 'Sub-11' };
  }
  if (name.includes('sub-13') || name.includes('sub 13') || name.includes('infantil b')) {
    return { rank: 4, label: 'Sub-13', canonicalAgeGroup: 'Sub-13' };
  }
  if (name.includes('sub-15') || name.includes('sub 15')) {
    return { rank: 5, label: 'Sub-15', canonicalAgeGroup: 'Sub-15' };
  }
  if (
    name.includes('cadet') ||
    name.includes('sub-18') ||
    name.includes('sub 18') ||
    name.includes('juvenil')
  ) {
    return { rank: 6, label: 'Cadetes (Sub-18)', canonicalAgeGroup: 'Cadetes (Sub-18)' };
  }
  if (
    name.includes('junior') ||
    name.includes('sub-21') ||
    name.includes('sub 21')
  ) {
    return { rank: 7, label: 'Junior (Sub-21)', canonicalAgeGroup: 'Junior (Sub-21)' };
  }
  if (name.includes('novicio') || name.includes('iniciacion')) {
    return { rank: 9, label: 'Novicios', canonicalAgeGroup: 'Novicios' };
  }
  if (
    name.includes('senior') ||
    name.includes('absolut') ||
    name.includes('adulto') ||
    name.includes('primera')
  ) {
    return { rank: 8, label: 'Senior', canonicalAgeGroup: 'Senior' };
  }
  if (name.includes('master') || name.includes('veteran')) {
    return { rank: 10, label: 'Master', canonicalAgeGroup: 'Master' };
  }

  // 2. VALIDACIÓN BIOMÉTRICA POR JUDOKAS INSCRITOS (SI EL NOMBRE NO ESPECIFICA EDAD)
  if (category.athlete_birth_years && category.athlete_birth_years.length > 0) {
    const validYears = category.athlete_birth_years.filter((y) => y > 1900 && y < 2100);
    if (validYears.length > 0) {
      const divRanks = validYears.map((y) => {
        const div = getDivisionByBirthYear(y);
        const divGroup = div ? div.ageGroup : 'Senior';
        return resolveCategoryAgeRank({ name: divGroup });
      });

      divRanks.sort((a, b) => a.rank - b.rank);
      const chosen = divRanks[0];
      if (chosen && chosen.rank < 99) {
        return chosen;
      }
    }
  }

  // 3. EVALUAR CAMPO age_group SI EXISTE EN BD
  const rawAge = (category.age_group || '').trim().toLowerCase();
  if (rawAge) {
    if (rawAge.includes('sub-7') || rawAge.includes('sub 7') || rawAge.includes('pre-infantil')) {
      return { rank: 1, label: 'Sub-7', canonicalAgeGroup: 'Sub-7' };
    }
    if (rawAge.includes('sub-9') || rawAge.includes('sub 9') || rawAge.includes('sub9')) {
      return { rank: 2, label: 'Sub-9', canonicalAgeGroup: 'Sub-9' };
    }
    if (rawAge.includes('sub-11') || rawAge.includes('sub 11') || rawAge.includes('infantil a')) {
      return { rank: 3, label: 'Sub-11', canonicalAgeGroup: 'Sub-11' };
    }
    if (rawAge.includes('sub-13') || rawAge.includes('sub 13') || rawAge.includes('infantil b')) {
      return { rank: 4, label: 'Sub-13', canonicalAgeGroup: 'Sub-13' };
    }
    if (rawAge.includes('sub-15') || rawAge.includes('sub 15')) {
      return { rank: 5, label: 'Sub-15', canonicalAgeGroup: 'Sub-15' };
    }
    if (
      rawAge.includes('cadet') ||
      rawAge.includes('sub-18') ||
      rawAge.includes('sub 18') ||
      rawAge.includes('juvenil')
    ) {
      return { rank: 6, label: 'Cadetes (Sub-18)', canonicalAgeGroup: 'Cadetes (Sub-18)' };
    }
    if (
      rawAge.includes('junior') ||
      rawAge.includes('sub-21') ||
      rawAge.includes('sub 21')
    ) {
      return { rank: 7, label: 'Junior (Sub-21)', canonicalAgeGroup: 'Junior (Sub-21)' };
    }
    if (rawAge.includes('novicio') || rawAge.includes('iniciacion')) {
      return { rank: 9, label: 'Novicios', canonicalAgeGroup: 'Novicios' };
    }
    if (
      rawAge.includes('senior') ||
      rawAge.includes('absolut') ||
      rawAge.includes('adulto') ||
      rawAge.includes('primera')
    ) {
      return { rank: 8, label: 'Senior', canonicalAgeGroup: 'Senior' };
    }
    if (rawAge.includes('master') || rawAge.includes('veteran')) {
      return { rank: 10, label: 'Master', canonicalAgeGroup: 'Master' };
    }
  }

  return { rank: 99, label: category.name || 'Otras', canonicalAgeGroup: category.age_group || 'Otras' };
}

/**
 * Retorna la jerarquía numérica de la división de edad.
 * 1. Sub-7
 * 2. Sub-9
 * 3. Sub-11
 * 4. Sub-13
 * 5. Sub-15
 * 6. Cadetes (Sub-18)
 * 7. Junior (Sub-21)
 * 8. Senior / Absoluto
 * 9. Novicios (Novicio Juvenil, Novicio Adulto)
 * 10. Master / Veteranos
 * 99. Otras / Personalizadas
 */
export function getDivisionSortRank(name: string, ageGroup?: string | null): number {
  return resolveCategoryAgeRank({ name, age_group: ageGroup }).rank;
}

/**
 * Retorna la jerarquía numérica de género:
 * 1. Femenino / Damas
 * 2. Masculino / Varones
 * 3. Mixto / Open
 */
export function getGenderSortRank(name: string, gender?: string): number {
  if (gender) {
    const g = gender.toUpperCase();
    if (g === 'F') return 1;
    if (g === 'M') return 2;
    if (g === 'MIXED') return 3;
  }
  const lower = (name || '').toLowerCase();
  if (lower.includes('femenin') || lower.includes('damas') || lower.includes('mujeres')) return 1;
  if (lower.includes('masculin') || lower.includes('varones') || lower.includes('hombres')) return 2;
  return 3;
}

/**
 * Extrae el valor numérico de peso para ordenamiento aritmético.
 * Garantiza que -60kg < -66kg < -73kg < -81kg < -100kg.
 * Las categorías pesadas abiertas con "+" (ej: +100kg, +78kg) reciben un desplazamiento
 * de +10000 para situarse siempre al final de su división.
 */
export function getWeightSortValue(categoryName: string): number {
  if (!categoryName) return 99999;
  // 1. Coincidencia con 'kg' explícito (ej: -73kg, +100kg, -100 kg)
  const kgMatch = categoryName.match(/([+-])\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) {
    const isPlus = kgMatch[1] === '+';
    const val = parseFloat(kgMatch[2]);
    return isPlus ? 10000 + val : val;
  }
  // 2. Coincidencia al final del texto con signo (ej: "-73")
  const endSignMatch = categoryName.match(/([+-])\s*(\d+(?:\.\d+)?)\s*$/);
  if (endSignMatch) {
    const isPlus = endSignMatch[1] === '+';
    const val = parseFloat(endSignMatch[2]);
    return isPlus ? 10000 + val : val;
  }
  return 99999;
}

/**
 * Función comparadora canónica para categorías de Judo.
 * Compara por: 1) División etaria, 2) Género, 3) Límite de peso numérico ascendente.
 */
export function compareJudoCategories(
  catA: { name: string; gender?: string; age_group?: string | null },
  catB: { name: string; gender?: string; age_group?: string | null }
): number {
  const nameA = catA?.name || '';
  const nameB = catB?.name || '';

  const divDiff = getDivisionSortRank(nameA, catA?.age_group) - getDivisionSortRank(nameB, catB?.age_group);
  if (divDiff !== 0) return divDiff;

  const genDiff = getGenderSortRank(nameA, catA?.gender) - getGenderSortRank(nameB, catB?.gender);
  if (genDiff !== 0) return genDiff;

  const weightDiff = getWeightSortValue(nameA) - getWeightSortValue(nameB);
  if (weightDiff !== 0) return weightDiff;

  return nameA.localeCompare(nameB);
}

/**
 * Ordena un arreglo de nombres de categoría en formato string.
 */
export function sortCategoryNames(names: string[]): string[] {
  return [...names].sort((a, b) => compareJudoCategories({ name: a }, { name: b }));
}

/**
 * Ordena un arreglo de objetos de categoría que tengan al menos la propiedad `name`.
 */
export function sortCategories<T extends { name: string; gender?: string }>(categories: T[]): T[] {
  return [...categories].sort(compareJudoCategories);
}

