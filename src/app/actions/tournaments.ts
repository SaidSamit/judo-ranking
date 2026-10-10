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
      organization_id: organizationId,
      name: stationName,
      slug,
      type: 'TATAMI_TABLE',
      tatami_number: i,
      pin_hash: pinHash,
      is_active: true,
      updated_at: nowIso,
    });
  }

  let injectedCount = 0;

  // Inyección de deportistas seleccionada
  if (input.injectExistingAthletes) {
    injectedCount = BASE_ATHLETES_ROSTER.length;
  }

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

    // 3. Upsert estaciones físicas
    await supabase.from('stations').upsert(stationUpserts, {
      onConflict: 'organization_id,slug',
    });

    // 4. Si se solicitó inyección de atletas, ejecutamos la confirmación relacional
    if (input.injectExistingAthletes && BASE_ATHLETES_ROSTER.length > 0) {
      await confirmRegistrationsAction(BASE_ATHLETES_ROSTER, organizationId, newId);
    }
  } catch (dbErr) {
    console.warn('Operando con respaldo seguro de memoria:', dbErr);
  }

  return {
    success: true,
    message: `Campeonato "${input.name.trim()}" creado exitosamente.${
      injectedCount > 0
        ? ` Se inyectaron ${injectedCount} deportistas ingresados a sus categorías.`
        : ''
    }`,
    tournament: newTournament,
    injectedAthletesCount: injectedCount,
  };
}

/**
 * Inyecta una nómina de deportistas a un campeonato específico.
 */
export async function injectAthletesToTournamentAction(
  tournamentId: string,
  athletesToInject: DraftAthletePayload[] = BASE_ATHLETES_ROSTER,
  organizationId: string = 'a0000000-0000-0000-0000-000000000001'
): Promise<{ success: boolean; count: number; message: string }> {
  if (!tournamentId) {
    return { success: false, count: 0, message: 'ID de campeonato inválido.' };
  }

  try {
    const res = await confirmRegistrationsAction(athletesToInject, organizationId, tournamentId);

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
    inMemoryTournaments = inMemoryTournaments.map((t) =>
      t.id === tournamentId
        ? {
            ...t,
            athlete_count: (t.athlete_count || 0) + athletesToInject.length,
          }
        : t
    );

    return {
      success: true,
      count: athletesToInject.length,
      message: `Se inyectaron ${athletesToInject.length} deportistas al campeonato (sesión activa).`,
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
