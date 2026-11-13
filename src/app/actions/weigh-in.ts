// ==============================================================================
// SERVER ACTIONS: ESTACIÓN DE PESAJE OFICIAL DE JUDO
// ==============================================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isWeightValidForCategory } from '@/lib/rules/judo-categories';

export interface WeighInAthlete {
  registration_id: string;
  athlete_id: string;
  rut_dni: string;
  name: string;
  club_name: string;
  category_id: string;
  category_name: string;
  gender: 'M' | 'F';
  birth_year: number;
  actual_weight?: number | null;
  weigh_in_status: 'PENDING' | 'PASSED' | 'DSQ' | 'DNS';
  weigh_in_at?: string | null;
}

export interface WeighInSummary {
  total: number;
  passed: number;
  pending: number;
  dsq: number;
  isClosed: boolean;
}

/**
 * Obtiene la lista de atletas registrados para la estación de pesaje.
 */
export async function getWeighInAthletesAction(
  tournamentId?: string
): Promise<{ success: boolean; athletes: WeighInAthlete[]; error?: string }> {
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

    const { data, error } = await supabase
      .from('tournament_registrations')
      .select(`
        id,
        actual_weight,
        weigh_in_status,
        weigh_in_at,
        category:categories (
          id,
          name,
          gender
        ),
        athlete:athletes (
          id,
          rut_dni,
          first_name,
          last_name,
          gender,
          birth_date,
          club:clubs (
            name
          )
        )
      `)
      .eq('tournament_id', targetTourId);

    if (error) {
      console.warn('[getWeighInAthletesAction] Error consultando Supabase:', error.message);
      return { success: false, athletes: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, athletes: [] };
    }

    const athletes: WeighInAthlete[] = data.map((item: any) => {
      const birthYear = item.athlete?.birth_date
        ? new Date(item.athlete.birth_date).getFullYear()
        : 2009;

      return {
        registration_id: item.id,
        athlete_id: item.athlete?.id || '',
        rut_dni: item.athlete?.rut_dni || '',
        name: `${item.athlete?.first_name || ''} ${item.athlete?.last_name || ''}`.trim(),
        club_name: item.athlete?.club?.name || 'Independiente',
        category_id: item.category?.id || '',
        category_name: item.category?.name || 'Categoría Oficial',
        gender: (item.athlete?.gender as 'M' | 'F') || 'M',
        birth_year: birthYear,
        actual_weight: item.actual_weight,
        weigh_in_status: item.weigh_in_status || 'PENDING',
        weigh_in_at: item.weigh_in_at,
      };
    });

    return { success: true, athletes };
  } catch (err: any) {
    console.error('[getWeighInAthletesAction] Error inesperado:', err);
    return { success: false, athletes: [], error: err.message };
  }
}

/**
 * Registra el peso real del atleta y su estado de aprobación.
 * Si se especifica newCategoryName, busca o crea la nueva categoría respetando
 * el género y división etaria reales del atleta.
 */
export async function recordAthleteWeightAction(params: {
  registrationId: string;
  actualWeight: number;
  status: 'PASSED' | 'DSQ';
  newCategoryName?: string;
  tournamentId?: string;
  organizationId?: string;
}): Promise<{
  success: boolean;
  message: string;
  updatedCategory?: string;
  updatedRegistrations?: Array<{
    registration_id: string;
    category_id: string;
    category_name: string;
    actual_weight: number;
    weigh_in_status: 'PASSED' | 'DSQ';
  }>;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();
    const {
      registrationId,
      actualWeight,
      status,
      newCategoryName,
      tournamentId = 'e0000000-0000-0000-0000-000000000001',
      organizationId = 'a0000000-0000-0000-0000-000000000001',
    } = params;

    // 1. Consultar la inscripción actual para recuperar los datos reales del atleta
    const { data: regInfo } = await supabase
      .from('tournament_registrations')
      .select(`
        id,
        athlete_id,
        tournament_id,
        organization_id,
        athlete:athletes (
          id,
          gender,
          birth_date
        )
      `)
      .eq('id', registrationId)
      .maybeSingle();

    const actualTourId = regInfo?.tournament_id || tournamentId;
    const actualOrgId = regInfo?.organization_id || organizationId;
    const athleteData = regInfo?.athlete as any;
    const athleteId = regInfo?.athlete_id || athleteData?.id;
    const athleteGender = athleteData?.gender || 'M';

    let targetCategoryId: string | undefined;

    // Si hubo cambio de categoría (por exceso de peso a categoría superior)
    if (newCategoryName && newCategoryName.trim()) {
      const cleanCat = newCategoryName.trim();
      const { data: existingCat } = await supabase
        .from('categories')
        .select('id')
        .eq('tournament_id', actualTourId)
        .ilike('name', cleanCat)
        .maybeSingle();

      if (existingCat) {
        targetCategoryId = existingCat.id;
      } else {
        // Derivar dinámicamente género y grupo etario
        const lower = cleanCat.toLowerCase();
        const isFemale =
          lower.includes('femenin') ||
          lower.includes('damas') ||
          lower.includes('mujeres') ||
          athleteGender === 'F';
        const gender: 'M' | 'F' = isFemale ? 'F' : 'M';

        let ageGroup = 'Cadetes';
        if (lower.includes('sub-11') || lower.includes('sub 11')) ageGroup = 'Sub-11';
        else if (lower.includes('sub-13') || lower.includes('sub 13')) ageGroup = 'Sub-13';
        else if (lower.includes('sub-15') || lower.includes('sub 15')) ageGroup = 'Sub-15';
        else if (lower.includes('cadet') || lower.includes('sub-18') || lower.includes('sub 18')) ageGroup = 'Cadetes';
        else if (lower.includes('junior') || lower.includes('sub-21') || lower.includes('sub 21')) ageGroup = 'Junior';
        else if (lower.includes('senior') || lower.includes('adulto')) ageGroup = 'Senior';
        else if (lower.includes('master')) ageGroup = 'Master';

        const weightMatch = cleanCat.match(/([+-]?\d+(?:\.\d+)?)\s*kg/i);
        const maxWeight = weightMatch ? parseFloat(weightMatch[1].replace('+', '')) : null;
        const matchDuration = ageGroup.startsWith('Sub-1') ? 180 : 240;

        // Crear la nueva categoría sin valores hardcodeados
        const { data: newCat, error: createCatErr } = await supabase
          .from('categories')
          .insert({
            organization_id: actualOrgId,
            tournament_id: actualTourId,
            name: cleanCat,
            age_group: ageGroup,
            gender: gender,
            max_weight: maxWeight,
            match_duration_seconds: matchDuration,
            is_official: true,
          })
          .select('id')
          .single();

        if (createCatErr) {
          throw new Error(`Error creando nueva categoría: ${createCatErr.message}`);
        }
        targetCategoryId = newCat.id;
      }
    }

    const nowIso = new Date().toISOString();
    const updatedRegistrations: Array<{
      registration_id: string;
      category_id: string;
      category_name: string;
      actual_weight: number;
      weigh_in_status: 'PASSED' | 'DSQ';
    }> = [];

    // Si es reclasificación puntual hacia una nueva categoría
    if (targetCategoryId) {
      const { error: updateErr } = await supabase
        .from('tournament_registrations')
        .update({
          actual_weight: actualWeight,
          weigh_in_status: status,
          weigh_in_at: nowIso,
          updated_at: nowIso,
          category_id: targetCategoryId,
        })
        .eq('id', registrationId);

      if (updateErr) {
        throw new Error(`Error actualizando pesaje: ${updateErr.message}`);
      }

      updatedRegistrations.push({
        registration_id: registrationId,
        category_id: targetCategoryId,
        category_name: newCategoryName!.trim(),
        actual_weight: actualWeight,
        weigh_in_status: status,
      });
    }

    // Sincronizar el peso real en todas las demás categorías del mismo atleta en este campeonato
    if (athleteId) {
      const { data: siblingRegs, error: sibErr } = await supabase
        .from('tournament_registrations')
        .select('id, category_id, category:categories(id, name)')
        .eq('tournament_id', actualTourId)
        .eq('athlete_id', athleteId);

      if (sibErr) {
        throw new Error(`Error consultando inscripciones del atleta: ${sibErr.message}`);
      }

      for (const reg of siblingRegs || []) {
        if (targetCategoryId && reg.id === registrationId) continue;

        const catObj = Array.isArray(reg.category) ? reg.category[0] : reg.category;
        const catName = catObj?.name || '';
        const { valid } = catName ? isWeightValidForCategory(actualWeight, catName) : { valid: status === 'PASSED' };
        const regStatus: 'PASSED' | 'DSQ' = valid ? 'PASSED' : 'DSQ';

        const { error: syncErr } = await supabase
          .from('tournament_registrations')
          .update({
            actual_weight: actualWeight,
            weigh_in_status: regStatus,
            weigh_in_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', reg.id);

        if (syncErr) {
          throw new Error(`Error sincronizando pesaje en categoría "${catName}": ${syncErr.message}`);
        }

        updatedRegistrations.push({
          registration_id: reg.id,
          category_id: reg.category_id,
          category_name: catName,
          actual_weight: actualWeight,
          weigh_in_status: regStatus,
        });
      }
    } else if (!targetCategoryId) {
      const { error: updateErr } = await supabase
        .from('tournament_registrations')
        .update({
          actual_weight: actualWeight,
          weigh_in_status: status,
          weigh_in_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', registrationId);

      if (updateErr) {
        throw new Error(`Error actualizando pesaje: ${updateErr.message}`);
      }
    }

    const msg = targetCategoryId
      ? `Peso ${actualWeight}kg registrado (${status}). Atleta reubicado con éxito a "${newCategoryName}".`
      : updatedRegistrations.length > 1
      ? `Peso ${actualWeight}kg sincronizado y validado en las ${updatedRegistrations.length} categorías del judoka.`
      : `Peso ${actualWeight}kg registrado (${status}) exitosamente.`;

    return {
      success: true,
      message: msg,
      updatedCategory: newCategoryName,
      updatedRegistrations,
    };
  } catch (err: any) {
    console.error('[recordAthleteWeightAction] Error:', err);
    return {
      success: false,
      message: 'Ocurrió un error al registrar el pesaje.',
      error: err.message,
    };
  }
}
