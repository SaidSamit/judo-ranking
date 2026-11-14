// ==============================================================================
// PARSER INTELIGENTE DE PLANILLAS EXCEL DE INSCRIPCIÓN DE JUDO (.XLSX / .XLS / .CSV)
// ==============================================================================
// Diseñado para interpretar automáticamente plantillas oficiales de clubes
// (como Ficha_Hiroshima_2026.xlsx) y planillas genéricas de delegaciones.
// Admite multi-categoría: un mismo atleta en 2 filas con distintas categorías.
// ==============================================================================

import * as XLSX from 'xlsx';
import { DraftAthletePayload } from '@/app/actions/registrations';
import { getAvailableCategoriesForAthlete } from '@/lib/rules/judo-categories';

export interface ParsedRosterAthlete extends DraftAthletePayload {
  birth_year: number;
  club_name: string;
  grade?: string;
  needsReview?: boolean;
  reviewReason?: string;
}

export interface NormalizedCategoryResult {
  category: string;
  isValid: boolean;
  divisionLabel?: string;
  weightFormatted?: string;
  reviewReason?: string;
}

/**
 * Normaliza la denominación de categoría a partir de división, género y peso.
 * Ej: "SUB 15", "MASCULINO", "-48" -> "Sub-15 Masculino -48kg"
 * Ej: "SUB 18", "FEMENINO", "-52" -> "Cadetes (Sub-18) Femenino -52kg"
 *
 * REGLA ESTRICTA DE CERTEZA 100%:
 * Si falta el peso o la división no se pueden inferir con 100% de certeza matemática o reglamentaria,
 * NO inventa ni adivina la categoría. Retorna isValid: false y reviewReason explicativo.
 */
export function normalizeJudoCategory(
  rawCategory: string,
  gender: 'M' | 'F',
  rawWeight?: string | number,
  birthYear?: number
): NormalizedCategoryResult {
  const cleanCat = (rawCategory || '').trim();
  const cleanWeightStr = String(rawWeight || '')
    .trim()
    .replace(/[^\d.+-]/g, '');

  let weightFormatted = '';
  if (cleanWeightStr) {
    if (!cleanWeightStr.startsWith('-') && !cleanWeightStr.startsWith('+')) {
      weightFormatted = `-${cleanWeightStr}kg`;
    } else {
      weightFormatted = `${cleanWeightStr}kg`;
    }
  }

  const genderLabel = gender === 'M' ? 'Masculino' : 'Femenino';
  const lower = cleanCat.toLowerCase();

  // 1. Si la categoría ya viene completa con peso y género en el texto
  // (ej: "Cadetes (Sub-18) Masculino -60kg", "Sub-15 Femenino -52kg")
  const hasKg = lower.includes('kg');
  const hasGenderInCat =
    lower.includes('masculino') ||
    lower.includes('femenino') ||
    lower.includes('varones') ||
    lower.includes('damas');
  const hasSpecificWeight = /[+-]?\d{2,3}\s*kg/i.test(cleanCat);

  if (hasKg && (hasGenderInCat || hasSpecificWeight)) {
    return {
      category: cleanCat,
      isValid: true,
      weightFormatted: cleanCat.match(/[+-]?\d{2,3}\s*kg/i)?.[0] || '',
    };
  }

  // 2. Mapeo estándar según divisiones oficiales de judo
  let divisionLabel = '';
  if (lower.includes('sub 9') || lower.includes('sub-9')) {
    divisionLabel = 'Sub-9';
  } else if (lower.includes('sub 11') || lower.includes('sub-11')) {
    divisionLabel = 'Sub-11';
  } else if (lower.includes('sub 13') || lower.includes('sub-13')) {
    divisionLabel = 'Sub-13';
  } else if (lower.includes('sub 15') || lower.includes('sub-15')) {
    divisionLabel = 'Sub-15';
  } else if (lower.includes('sub 18') || lower.includes('sub-18') || lower.includes('cadet')) {
    divisionLabel = 'Cadetes (Sub-18)';
  } else if (lower.includes('sub 21') || lower.includes('sub-21') || lower.includes('junior')) {
    divisionLabel = 'Junior (Sub-21)';
  } else if (lower.includes('absolut') || lower.includes('senior')) {
    divisionLabel = 'Senior';
  } else if (lower.includes('novicio')) {
    divisionLabel = lower.includes('adult') ? 'Novicio Adulto' : 'Novicio Juvenil';
  } else if (lower.includes('master')) {
    divisionLabel = 'Master';
  }

  // Fallback si no viene división en texto: calcular según año de nacimiento (100% certeza de edad)
  if (!divisionLabel && birthYear && birthYear >= 1940) {
    const computed = getAvailableCategoriesForAthlete(birthYear, gender);
    divisionLabel = computed.divisionName || '';
  }

  // A. Si tiene división Y tiene peso -> 100% Certeza
  if (divisionLabel && weightFormatted) {
    return {
      category: `${divisionLabel} ${genderLabel} ${weightFormatted}`,
      isValid: true,
      divisionLabel,
      weightFormatted,
    };
  }

  // B. Si tiene división pero NO tiene peso -> FALTA PESO (Sin 100% de certeza)
  if (divisionLabel && !weightFormatted) {
    return {
      category: `${divisionLabel} ${genderLabel} (Falta peso)`,
      isValid: false,
      divisionLabel,
      reviewReason: 'Falta especificar peso reglamentario',
    };
  }

  // C. Si tiene peso pero NO tiene división reconocida
  if (!divisionLabel && weightFormatted) {
    return {
      category: `Categoría ${genderLabel} ${weightFormatted} (Falta división)`,
      isValid: false,
      weightFormatted,
      reviewReason: 'Falta división etaria',
    };
  }

  // D. Ni peso ni división
  return {
    category: cleanCat ? `${cleanCat} (Revisión Requerida)` : '(Sin categoría asignada)',
    isValid: false,
    reviewReason: 'Falta peso y categoría reglamentaria',
  };
}

/**
 * Parsea una fecha en texto (DD-MM-AAAA, DD/MM/AAAA) o número serial de Excel.
 * Retorna isValid: true sólo si la fecha/año fue extraída con certeza entre 1940 y el año actual.
 */
function parseBirthDate(rawDate: any): { birthDateStr: string; birthYear: number; isValid: boolean } {
  const currentYear = new Date().getFullYear();
  let birthYear = 2008;
  let birthDateStr = '2008-01-01';

  if (!rawDate && rawDate !== 0) {
    return { birthDateStr, birthYear, isValid: false };
  }

  // 1. Si viene como número serial de Excel (ej: 43266) o año directo (ej: 2009)
  if (typeof rawDate === 'number') {
    if (rawDate >= 1940 && rawDate <= currentYear) {
      return {
        birthDateStr: `${rawDate}-01-01`,
        birthYear: rawDate,
        isValid: true,
      };
    }
    const parsedDate = XLSX.SSF.parse_date_code(rawDate);
    if (parsedDate && parsedDate.y && parsedDate.y >= 1940 && parsedDate.y <= currentYear) {
      birthYear = parsedDate.y;
      const m = String(parsedDate.m).padStart(2, '0');
      const d = String(parsedDate.d).padStart(2, '0');
      birthDateStr = `${birthYear}-${m}-${d}`;
      return { birthDateStr, birthYear, isValid: true };
    }
    return { birthDateStr, birthYear, isValid: false };
  }

  // 2. Si viene como string
  const str = String(rawDate).trim();
  if (!str) {
    return { birthDateStr, birthYear, isValid: false };
  }

  // Formato DD-MM-AAAA o DD/MM/AAAA
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = parseInt(dmyMatch[3], 10);
    if (year >= 1940 && year <= currentYear) {
      return {
        birthDateStr: `${year}-${month}-${day}`,
        birthYear: year,
        isValid: true,
      };
    }
  }

  // Formato AAAA-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    if (year >= 1940 && year <= currentYear) {
      return {
        birthDateStr: `${year}-${month}-${day}`,
        birthYear: year,
        isValid: true,
      };
    }
  }

  // Solo año (ej: 2009)
  const yearOnly = parseInt(str, 10);
  if (!isNaN(yearOnly) && yearOnly >= 1940 && yearOnly <= currentYear) {
    return {
      birthDateStr: `${yearOnly}-01-01`,
      birthYear: yearOnly,
      isValid: true,
    };
  }

  return { birthDateStr, birthYear, isValid: false };
}

/**
 * Genera un identificador único determinista para el deportista en caso de que
 * la planilla Excel no incluya columna de RUT.
 * Asegura que si Juanito Perez aparece en 2 filas con distintas categorías,
 * ambas reciban el mismo RUT identificador.
 */
function generateDeterministicRut(fullName: string, birthYear: number): string {
  const normName = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const shortName = normName.slice(0, 10) || 'judoka';
  return `CHI-${shortName}-${birthYear}`;
}

/**
 * Parsea un ArrayBuffer o File de Excel (.xlsx / .xls) y retorna la nómina de atletas.
 */
export function parseExcelRoster(fileBuffer: ArrayBuffer): {
  success: boolean;
  athletes: ParsedRosterAthlete[];
  detectedClub?: string;
  message?: string;
} {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, athletes: [], message: 'El archivo Excel no contiene hojas de datos.' };
    }

    // Usar la primera hoja (Hoja1) o la hoja que contenga "Ficha" o "Inscripción"
    const targetSheetName =
      workbook.SheetNames.find((s: string) => /ficha|inscrip/i.test(s)) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];

    // Convertir hoja a matriz de filas 2D
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      raw: true,
    });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, athletes: [], message: 'La hoja seleccionada está vacía.' };
    }

    // 1. Detectar club global en el encabezado si existe (ej: "CLUB: HIROSHIMA")
    let detectedClub = 'Club Judo Hiroshima';
    for (let r = 0; r < Math.min(10, rawRows.length); r++) {
      const row = rawRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim();
        if (/^club\s*:/i.test(cell)) {
          const valInSameCell = cell.replace(/^club\s*:\s*/i, '').trim();
          const valInNextCell = String(row[c + 1] || '').trim();
          const clubFound = valInSameCell || valInNextCell;
          if (clubFound) {
            detectedClub = clubFound;
            break;
          }
        }
      }
    }

    // 2. Localizar la fila de encabezados de la tabla de atletas
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(25, rawRows.length); r++) {
      const row = rawRows[r] || [];
      const rowText = row.map((cell) => String(cell || '').trim().toLowerCase());

      const hasName = rowText.some((t) => t.includes('nombre'));
      const hasLastName = rowText.some((t) => t.includes('apellido'));
      const hasCategoryOrWeight = rowText.some((t) => t.includes('categor') || t.includes('peso'));

      if (hasName && (hasLastName || hasCategoryOrWeight)) {
        headerRowIdx = r;
        row.forEach((cell, colIdx) => {
          const t = String(cell || '').trim().toLowerCase();
          if (t.includes('nombre') && !t.includes('completo')) colMap['nombre'] = colIdx;
          if (t.includes('nombre completo') || t === 'atleta') colMap['nombre_completo'] = colIdx;
          if (t.includes('apellido paterno') || (t.includes('apellido') && !t.includes('materno'))) {
            colMap['apellido_paterno'] = colIdx;
          }
          if (t.includes('apellido materno')) colMap['apellido_materno'] = colIdx;
          if (t.includes('genero') || t.includes('sexo')) colMap['genero'] = colIdx;
          if (t.includes('fec') || t.includes('nacimiento') || t.includes('nac') || t.includes('fecha')) {
            colMap['fec_nac'] = colIdx;
          }
          if (t.includes('club') || t.includes('equipo')) colMap['club'] = colIdx;
          if (t.includes('grado') || t.includes('cinturon') || t.includes('kyu')) {
            colMap['grado'] = colIdx;
          }
          if (t.includes('categor')) colMap['categoria'] = colIdx;
          if (t.includes('peso')) colMap['peso'] = colIdx;
          if (t.includes('rut') || t.includes('dni')) colMap['rut'] = colIdx;
        });
        break;
      }
    }

    if (headerRowIdx === -1) {
      return {
        success: false,
        athletes: [],
        message: 'No se reconoció la fila de encabezados con las columnas "NOMBRE", "APELLIDOS", "CATEGORÍA".',
      };
    }

    // 3. Extraer atletas desde la fila siguiente al encabezado
    const athletes: ParsedRosterAthlete[] = [];

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      // Extraer nombre
      const namePart = colMap['nombre'] !== undefined ? String(row[colMap['nombre']] || '').trim() : '';
      const lastNamePaterno =
        colMap['apellido_paterno'] !== undefined ? String(row[colMap['apellido_paterno']] || '').trim() : '';
      const lastNameMaterno =
        colMap['apellido_materno'] !== undefined ? String(row[colMap['apellido_materno']] || '').trim() : '';
      const fullNameDirect =
        colMap['nombre_completo'] !== undefined ? String(row[colMap['nombre_completo']] || '').trim() : '';

      let fullName = fullNameDirect;
      if (!fullName) {
        fullName = [namePart, lastNamePaterno, lastNameMaterno].filter(Boolean).join(' ').trim();
      }

      // Si la fila no contiene nombre o es solo un número de secuencia vacío, omitir
      if (!fullName || fullName.length < 2) continue;

      // Género
      const rawGender =
        colMap['genero'] !== undefined ? String(row[colMap['genero']] || '').trim().toUpperCase() : '';
      let gender: 'M' | 'F' = 'M';
      let hasValidGender = false;

      if (rawGender) {
        if (
          rawGender.startsWith('F') ||
          rawGender.includes('FEM') ||
          rawGender.includes('MUJER') ||
          rawGender.includes('DAMA')
        ) {
          gender = 'F';
          hasValidGender = true;
        } else if (
          rawGender.startsWith('M') ||
          rawGender.includes('MASC') ||
          rawGender.includes('VARON') ||
          rawGender.includes('HOMBRE')
        ) {
          gender = 'M';
          hasValidGender = true;
        }
      }

      // Fecha y año de nacimiento
      const rawDate = colMap['fec_nac'] !== undefined ? row[colMap['fec_nac']] : '';
      const { birthDateStr, birthYear, isValid: hasValidBirthYear } = parseBirthDate(rawDate);

      // Club
      let club =
        colMap['club'] !== undefined ? String(row[colMap['club']] || '').trim() : '';
      if (!club) {
        club = detectedClub;
      }

      // Grado
      const grade =
        colMap['grado'] !== undefined ? String(row[colMap['grado']] || '').trim() : '';

      // Categoría y Peso
      const rawCat =
        colMap['categoria'] !== undefined ? String(row[colMap['categoria']] || '').trim() : '';
      const rawWeight =
        colMap['peso'] !== undefined ? row[colMap['peso']] : '';

      const catResult = normalizeJudoCategory(
        rawCat,
        gender,
        rawWeight,
        hasValidBirthYear ? birthYear : undefined
      );

      // Extraer peso numérico
      let parsedWeightNum: number | undefined;
      if (rawWeight !== undefined && rawWeight !== '') {
        const num = parseFloat(String(rawWeight).replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) parsedWeightNum = num;
      }

      // RUT: si la planilla lo tiene se usa; si no, generar identificador determinista
      let rut =
        colMap['rut'] !== undefined ? String(row[colMap['rut']] || '').trim().toUpperCase() : '';
      if (!rut) {
        rut = generateDeterministicRut(fullName, birthYear);
      }

      // Validar si algún dato no puede inferirse con 100% de certeza
      const reviewReasons: string[] = [];
      if (!hasValidBirthYear) {
        reviewReasons.push('Falta fecha de nacimiento');
      }
      if (!hasValidGender) {
        reviewReasons.push('Falta género (M/F)');
      }
      if (!catResult.isValid) {
        reviewReasons.push(catResult.reviewReason || 'Falta peso o categoría reglamentaria');
      }

      const needsReview = reviewReasons.length > 0;
      const reviewReason = needsReview ? reviewReasons.join(' • ') : undefined;

      athletes.push({
        name: fullName,
        club_name: club,
        rut_dni: rut,
        gender,
        birth_year: birthYear,
        birth_date: birthDateStr,
        category: catResult.category,
        weight: parsedWeightNum,
        grade: grade || undefined,
        needsReview,
        reviewReason,
      });
    }

    return {
      success: true,
      athletes,
      detectedClub,
      message: `Se extrajeron ${athletes.length} registros exitosamente desde la planilla Excel.`,
    };
  } catch (err: any) {
    console.error('[parseExcelRoster] Error:', err);
    return {
      success: false,
      athletes: [],
      message: `Error analizando la planilla Excel: ${err.message}`,
    };
  }
}
