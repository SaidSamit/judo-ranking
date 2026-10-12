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

