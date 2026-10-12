// ==============================================================================
// SERVER ACTIONS: GESTIÓN DE CAMPEONATOS E INYECCIÓN DE DEPORTISTAS
// ==============================================================================
//
// REGLAS Y OBJETIVOS:
// 1. Permite crear campeonatos con configuración de tatamis y fechas oficiales.
// 2. Inyección de Atletas: Permite asociar masivamente los deportistas ingresados
//    en el sistema al campeonato creado, creando las categorías necesarias en la DB.
// 3. Aprovisionamiento automático de estaciones y PINs para cada tatami.
// 4. Conmutación reactiva de torneo activo.
//
// ==============================================================================

'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmRegistrationsAction, DraftAthletePayload } from '@/app/actions/registrations';
import { BASE_ATHLETES_ROSTER } from '@/lib/data/roster-data';
import { getAvailableCategoriesForAthlete } from '@/lib/rules/judo-categories';

export interface TournamentItem {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'PENDING_APPROVAL';
  location: string;
  start_date: string;
  end_date: string;
  tatami_count: number;
  athlete_count: number;
  categories_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateTournamentInput {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  tatami_count: number;
  injectExistingAthletes?: boolean;
}

// Almacén en memoria de respaldo para torneos
let inMemoryTournaments: TournamentItem[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    name: 'Torneo Regional Iquique Open 2026',
    status: 'ACTIVE',
    location: 'Polideportivo Central Iquique',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    tatami_count: 3,
    athlete_count: 8,
    categories_count: 4,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

/**
 * Obtiene la lista completa de campeonatos registrados.
 */
export async function getTournamentsAction(): Promise<{
  success: boolean;
  tournaments: TournamentItem[];
  activeTournamentId: string;
}> {
  try {
    const supabase = createAdminClient();

    const { data: tournamentsData, error: tourError } = await supabase
      .from('tournaments')
      .select('id, name, status, location, start_date, end_date, config, created_at')
      .order('created_at', { ascending: false });

    if (!tourError && tournamentsData && tournamentsData.length > 0) {
      // Consultar conteo de atletas registrados por torneo
      const { data: regData } = await supabase
        .from('tournament_registrations')
        .select('tournament_id, category_id');

      // Consultar categorías por torneo
      const { data: catData } = await supabase
        .from('categories')
        .select('tournament_id');

      const mapped: TournamentItem[] = tournamentsData.map((t) => {
        const config = (t.config as any) || {};
        const athleteCount = regData?.filter((r) => r.tournament_id === t.id).length || 0;
        const categoriesCount = catData?.filter((c) => c.tournament_id === t.id).length || 0;

        return {
          id: t.id,
          name: t.name,
          status: t.status,
          location: t.location || 'Sede Principal',
          start_date: t.start_date,
          end_date: t.end_date,
          tatami_count: config.tatami_count || 3,
          athlete_count: athleteCount > 0 ? athleteCount : (config.injected_athletes_count || 0),
          categories_count: categoriesCount > 0 ? categoriesCount : (config.categories_count || 1),
          is_active: t.status === 'ACTIVE',
          created_at: t.created_at,
        };
      });

      // Actualizar memoria
      inMemoryTournaments = mapped;
      const active = mapped.find((m) => m.is_active)?.id || mapped[0]?.id;

      return {
        success: true,
        tournaments: mapped,
        activeTournamentId: active,
      };
    } else if (!tourError && (!tournamentsData || tournamentsData.length === 0)) {
      // Si la base de datos no tiene torneos, persistimos el torneo inicial en Supabase
      const defaultTour = inMemoryTournaments[0];
      const nowIso = new Date().toISOString();
      await supabase.from('tournaments').upsert(
        {
          id: defaultTour.id,
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          name: defaultTour.name,
          status: 'ACTIVE',
          location: defaultTour.location,
          start_date: defaultTour.start_date,
          end_date: defaultTour.end_date,
          config: {
            tatami_count: defaultTour.tatami_count,
            score_types: ['IPPON', 'WAZA_ARI', 'YUKO'],
            best_of_limit: 6,
          },
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
    }
  } catch (err) {
    console.warn('Operando con respaldo en memoria de torneos:', err);
  }

  const activeId = inMemoryTournaments.find((t) => t.is_active)?.id || inMemoryTournaments[0].id;
  return {
    success: true,
    tournaments: inMemoryTournaments,
    activeTournamentId: activeId,
  };
}

/**
 * Crea un nuevo campeonato, aprovisiona sus tatamis con PINs seguros e inyecta los atletas si se solicita.
 */
export async function createTournamentAction(
  input: CreateTournamentInput,
  organizationId: string = 'a0000000-0000-0000-0000-000000000001'
): Promise<{
  success: boolean;
  message: string;
  tournament?: TournamentItem;
  injectedAthletesCount: number;
  error?: string;
}> {
  if (!input.name || !input.name.trim()) {
    return {
      success: false,
      message: 'El nombre del campeonato es obligatorio.',
      injectedAthletesCount: 0,
      error: 'VALIDATION_ERROR',
    };
  }

  const newId = crypto.randomUUID();
  const tatamiCount = Math.max(1, Math.min(16, Number(input.tatami_count) || 1));
  const startDate = input.start_date || new Date().toISOString().split('T')[0];
  const endDate = input.end_date || startDate;
  const location = input.location?.trim() || 'Gimnasio Polideportivo';
  const nowIso = new Date().toISOString();

  // Generar credenciales para cada tatami
  const stationUpserts = [];
  const credentialsList = [];

  for (let i = 1; i <= tatamiCount; i++) {
    const pin = crypto.randomInt(100000, 1000000).toString();
    const pinHash = await bcrypt.hash(pin, 10);
    const slug = `tatami-${i}`;
    const stationName = `Mesa de Control - Tatami ${i}`;

    credentialsList.push({
      tatami_number: i,
      station_slug: slug,
      station_name: stationName,
      pin,
      created_at: nowIso,
    });

    stationUpserts.push({
      tournament_id: newId,
      organization_id: organizationId,
      name: stationName,
      slug,
      type: 'TATAMI_TABLE',
      tatami_number: i,
      pin_code: pin,
      pin_hash: pinHash,
      is_active: true,
      updated_at: nowIso,
    });
  }

  // Inyección de deportistas seleccionada desde la base de datos
  let athletesToInject: DraftAthletePayload[] = [];
  if (input.injectExistingAthletes) {
    athletesToInject = await resolveExistingAthletesForTournament(organizationId);
  }
  const injectedCount = athletesToInject.length;

  const newTournament: TournamentItem = {
    id: newId,
    name: input.name.trim(),
    status: 'ACTIVE',
    location,
    start_date: startDate,
    end_date: endDate,
    tatami_count: tatamiCount,
    athlete_count: injectedCount,
    categories_count: injectedCount > 0 ? 4 : 0,
    is_active: true,
    created_at: nowIso,
  };

  // Marcar anteriores como no activos en memoria
  inMemoryTournaments = inMemoryTournaments.map((t) => ({ ...t, is_active: false }));
  inMemoryTournaments.unshift(newTournament);

  // Intentar persistir en Supabase
  try {
    const supabase = createAdminClient();

    // 1. Desactivar torneos previos
    await supabase.from('tournaments').update({ status: 'DRAFT' }).neq('id', newId);

    // 2. Insertar nuevo torneo
    const { error: tourError } = await supabase.from('tournaments').insert({
      id: newId,
      organization_id: organizationId,
      name: input.name.trim(),
      status: 'ACTIVE',
      location,
      start_date: startDate,
      end_date: endDate,
      config: {
        tatami_count: tatamiCount,
        credentials_generated_at: nowIso,
        tatami_credentials: credentialsList,
        injected_athletes_count: injectedCount,
        score_types: ['IPPON', 'WAZA_ARI', 'YUKO'],
        best_of_limit: 6,
      },
    });

    if (tourError) {
      console.warn('Error insertando torneo en Supabase:', tourError.message);
    }

    // 3. Upsert estaciones físicas vinculadas al nuevo torneo
    const { error: stationErr } = await supabase.from('stations').upsert(stationUpserts);
    if (stationErr && stationErr.message.includes('column')) {
      // Fallback de compatibilidad si la migración de columnas aún no se ha ejecutado en Supabase
      const legacyUpserts = stationUpserts.map(({ tournament_id, pin_code, ...rest }) => rest);
      await supabase.from('stations').upsert(legacyUpserts, {
        onConflict: 'organization_id,slug',
      });
    }

    // 4. Si se solicitó inyección de atletas, ejecutamos la confirmación relacional de los atletas reales
    if (input.injectExistingAthletes && athletesToInject.length > 0) {
      await confirmRegistrationsAction(athletesToInject, organizationId, newId);
    }
  } catch (dbErr) {
    console.warn('Operando con respaldo seguro de memoria:', dbErr);
  }

  return {
    success: true,
    message: `Campeonato "${input.name.trim()}" creado exitosamente.${
      injectedCount > 0
        ? ` Se inyectaron ${injectedCount} deportistas de la organización a sus categorías.`
        : ''
    }`,
    tournament: newTournament,
    injectedAthletesCount: injectedCount,
  };
}

/**
 * Consulta los atletas existentes de la organización en la base de datos
 * y los mapea con sus categorías sugeridas según su edad y género.
 */
async function resolveExistingAthletesForTournament(
  organizationId: string
): Promise<DraftAthletePayload[]> {
  try {
    const supabase = createAdminClient();

    // 1. Consultar todos los atletas registrados en la organización
    const { data: dbAthletes, error } = await supabase
      .from('athletes')
      .select(`
        id,
        rut_dni,
        first_name,
        last_name,
        gender,
        birth_date,
        club:clubs (
          name
        )
      `)
      .eq('organization_id', organizationId);

    if (error || !dbAthletes || dbAthletes.length === 0) {
      return BASE_ATHLETES_ROSTER;
    }

    // 2. Consultar inscripciones previas para reutilizar categorías habituales
    const { data: recentRegs } = await supabase
      .from('tournament_registrations')
      .select(`
        athlete_id,
        category:categories (
          name
        )
      `)
      .order('created_at', { ascending: false });

    const athleteCategoryMap = new Map<string, string>();
    (recentRegs || []).forEach((reg: any) => {
      if (reg.athlete_id && reg.category?.name && !athleteCategoryMap.has(reg.athlete_id)) {
        athleteCategoryMap.set(reg.athlete_id, reg.category.name);
      }
    });

    const currentYear = new Date().getFullYear();

    return dbAthletes.map((ath: any) => {
      const birthYear = ath.birth_date ? new Date(ath.birth_date).getFullYear() : 2008;
      const gender = (ath.gender as 'M' | 'F') || 'M';
      const clubName =
        ath.club?.name || (Array.isArray(ath.club) ? ath.club[0]?.name : 'Independiente');

      let categoryName = athleteCategoryMap.get(ath.id);
      if (!categoryName) {
        const catInfo = getAvailableCategoriesForAthlete(birthYear, gender, currentYear);
        categoryName =
          catInfo.categories[0] ||
          (gender === 'F' ? 'Senior Femenino -52kg' : 'Senior Masculino -66kg');
      }

      return {
        id: ath.id,
        name: `${ath.first_name} ${ath.last_name}`.trim(),
        club_name: clubName,
        category: categoryName,
        rut_dni: ath.rut_dni,
        gender: gender,
        birth_year: birthYear,
        birth_date: ath.birth_date,
      };
    });
  } catch (err) {
    console.warn('[resolveExistingAthletesForTournament] Error, usando respaldo:', err);
    return BASE_ATHLETES_ROSTER;
  }
}

/**
 * Inyecta una nómina de deportistas a un campeonato específico.
 */
export async function injectAthletesToTournamentAction(
  tournamentId: string,
  athletesToInject?: DraftAthletePayload[],
  organizationId: string = 'a0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; count: number; message: string }> {
  if (!tournamentId) {
    return { success: false, count: 0, message: 'ID de campeonato inválido.' };
  }

  try {
    const list =
      athletesToInject && athletesToInject.length > 0
        ? athletesToInject
        : await resolveExistingAthletesForTournament(organizationId);

    const res = await confirmRegistrationsAction(list, organizationId, tournamentId);

    // Actualizar memoria
    inMemoryTournaments = inMemoryTournaments.map((t) =>
      t.id === tournamentId
        ? {
            ...t,
            athlete_count: (t.athlete_count || 0) + res.count,
            categories_count: Math.max(t.categories_count || 1, 4),
          }
        : t
    );

    return {
      success: true,
      count: res.count,
      message: `Se inyectaron ${res.count} deportistas correctamente al campeonato.`,
    };
  } catch (err: any) {
    console.warn('Error inyectando en Supabase, aplicando a memoria:', err);
    return {
      success: true,
      count: 0,
      message: `Error al inyectar deportistas: ${err.message}`,
    };
  }
}

/**
 * Conmuta el campeonato activo del sistema.
 */
export async function setActiveTournamentAction(
  tournamentId: string
): Promise<{ success: boolean; message: string }> {
  inMemoryTournaments = inMemoryTournaments.map((t) => ({
    ...t,
    is_active: t.id === tournamentId,
    status: t.id === tournamentId ? 'ACTIVE' : 'DRAFT',
  }));

  try {
    const supabase = createAdminClient();
    await supabase.from('tournaments').update({ status: 'DRAFT' }).neq('id', tournamentId);
    await supabase.from('tournaments').update({ status: 'ACTIVE' }).eq('id', tournamentId);
  } catch (err) {
    console.warn('Error conmutando torneo activo en DB:', err);
  }

  return {
    success: true,
    message: 'Campeonato activado correctamente como torneo oficial en curso.',
  };
}

/**
 * Obtiene los detalles específicos de un campeonato aislado por su ID.
 */
export async function getTournamentDetailsAction(tournamentId: string): Promise<{
  success: boolean;
  tournament?: TournamentItem;
  error?: string;
}> {
  if (!tournamentId) {
    return { success: false, error: 'ID de campeonato inválido' };
  }

  try {
    const supabase = createAdminClient();

    const { data: tourData, error: tourErr } = await supabase
      .from('tournaments')
      .select('id, name, status, location, start_date, end_date, config, created_at')
      .eq('id', tournamentId)
      .maybeSingle();

    if (!tourErr && tourData) {
      // Conteo de atletas registrados estrictamente en este torneo
      const { data: regData } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('tournament_id', tournamentId);

      // Categorías estrictas de este torneo
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('tournament_id', tournamentId);

      const config = (tourData.config as any) || {};

      const mapped: TournamentItem = {
        id: tourData.id,
        name: tourData.name,
        status: tourData.status,
        location: tourData.location || 'Sede Principal',
        start_date: tourData.start_date,
        end_date: tourData.end_date,
        tatami_count: config.tatami_count || 3,
        athlete_count: regData ? regData.length : (config.injected_athletes_count || 0),
        categories_count: catData ? catData.length : 0,
        is_active: tourData.status === 'ACTIVE',
        created_at: tourData.created_at,
      };

      return { success: true, tournament: mapped };
    }
  } catch (err: any) {
    console.warn('Error consultando Supabase para detalle de torneo:', err.message);
  }

  // Buscar en almacén de memoria
  const memoryMatch = inMemoryTournaments.find((t) => t.id === tournamentId);
  if (memoryMatch) {
    return { success: true, tournament: memoryMatch };
  }

  return { success: false, error: 'Campeonato no encontrado' };
}

/**
 * Obtiene el resumen del campeonato oficial activo para el login institucional.
 */
export async function getActiveTournamentSummaryAction(): Promise<{
  id: string;
  name: string;
  tatamiCount: number;
} | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, config')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        name: data.name,
        tatamiCount: Number((data.config as any)?.tatami_count) || 2,
      };
    }
  } catch (err) {
    console.warn('Error obteniendo torneo activo:', err);
  }

  const memoryActive = inMemoryTournaments.find((t) => t.is_active) || inMemoryTournaments[0];
  if (memoryActive) {
    return {
      id: memoryActive.id,
      name: memoryActive.name,
      tatamiCount: memoryActive.tatami_count || 2,
    };
  }

  return null;
}


