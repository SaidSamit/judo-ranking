// ==============================================================================
// SERVER ACTIONS: ESTACIÓN DE PESAJE OFICIAL DE JUDO
// ==============================================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';

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
  tournamentId: string = 'e0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; athletes: WeighInAthlete[]; error?: string }> {
  try {
    const supabase = createAdminClient();

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
      .eq('tournament_id', tournamentId);

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
 * Si se especifica newCategoryName, busca o crea la nueva categoría y reubica la inscripción.
 */
export async function recordAthleteWeightAction(params: {
  registrationId: string;
  actualWeight: number;
  status: 'PASSED' | 'DSQ';
  newCategoryName?: string;
  tournamentId?: string;
  organizationId?: string;
}): Promise<{ success: boolean; message: string; updatedCategory?: string; error?: string }> {
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

    let targetCategoryId: string | undefined;

    // Si hubo cambio de categoría (por exceso de peso a categoría superior)
    if (newCategoryName && newCategoryName.trim()) {
      const cleanCat = newCategoryName.trim();
      const { data: existingCat } = await supabase
        .from('categories')
        .select('id')
        .eq('tournament_id', tournamentId)
        .ilike('name', cleanCat)
        .maybeSingle();

      if (existingCat) {
        targetCategoryId = existingCat.id;
      } else {
        // Crear la nueva categoría
        const { data: newCat, error: createCatErr } = await supabase
          .from('categories')
          .insert({
            organization_id: organizationId,
            tournament_id: tournamentId,
            name: cleanCat,
            age_group: 'Cadetes',
            gender: 'M',
            match_duration_seconds: 240,
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

    const updatePayload: Record<string, any> = {
      actual_weight: actualWeight,
      weigh_in_status: status,
      weigh_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (targetCategoryId) {
      updatePayload.category_id = targetCategoryId;
    }

    const { error: updateErr } = await supabase
      .from('tournament_registrations')
      .update(updatePayload)
      .eq('id', registrationId);

    if (updateErr) {
      throw new Error(`Error actualizando pesaje: ${updateErr.message}`);
    }

    const msg = targetCategoryId
      ? `Peso ${actualWeight}kg registrado (${status}). Atleta reubicado con éxito a "${newCategoryName}".`
      : `Peso ${actualWeight}kg registrado (${status}) exitosamente.`;

    return {
      success: true,
      message: msg,
      updatedCategory: newCategoryName,
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
