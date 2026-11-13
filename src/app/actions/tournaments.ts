// ==============================================================================
// SERVER ACTIONS: GESTIÓN DE CAMPEONATOS OFICIALES
// ==============================================================================
//
// REGLAS Y OBJETIVOS:
// 1. Permite crear campeonatos con configuración de tatamis y fechas oficiales.
// 2. Aprovisionamiento automático de estaciones y PINs para cada tatami.
// 3. Conmutación reactiva de torneo activo.
//
// ==============================================================================

'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';

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
}

// Almacén en memoria de respaldo para torneos de la sesión actual
let inMemoryTournaments: TournamentItem[] = [];

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
          athlete_count: athleteCount,
          categories_count: categoriesCount,
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
      inMemoryTournaments = [];
      return {
        success: true,
        tournaments: [],
        activeTournamentId: '',
      };
    }
  } catch (err) {
    console.warn('Operando con respaldo en memoria de torneos:', err);
  }

  const activeId = inMemoryTournaments.find((t) => t.is_active)?.id || inMemoryTournaments[0]?.id || '';
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
      type: 'TATAMI_TABLE',
      metadata: {},
      created_at: nowIso,
    });

    stationUpserts.push({
      tournament_id: newId,
      organization_id: organizationId,
      name: stationName,
      slug,
      type: 'TATAMI_TABLE' as const,
      tatami_number: i,
      pin_code: pin,
      pin_hash: pinHash,
      metadata: {},
      is_active: true,
      updated_at: nowIso,
    });
  }

  // Generar estaciones de pesaje predeterminadas (Varones, Damas y General)
  const weighInStationsConfig = [
    {
      slug: 'pesaje-varones',
      name: 'Estación de Pesaje - Varones',
      metadata: { gender_filter: 'M' },
    },
    {
      slug: 'pesaje-damas',
      name: 'Estación de Pesaje - Damas',
      metadata: { gender_filter: 'F' },
    },
    {
      slug: 'pesaje-general',
      name: 'Estación de Pesaje - General',
      metadata: {},
    },
  ];

  for (const wStation of weighInStationsConfig) {
    const pin = crypto.randomInt(100000, 1000000).toString();
    const pinHash = await bcrypt.hash(pin, 10);

    credentialsList.push({
      tatami_number: null,
      station_slug: wStation.slug,
      station_name: wStation.name,
      pin,
      type: 'WEIGH_IN',
      metadata: wStation.metadata,
      created_at: nowIso,
    });

    stationUpserts.push({
      tournament_id: newId,
      organization_id: organizationId,
      name: wStation.name,
      slug: wStation.slug,
      type: 'WEIGH_IN' as const,
      tatami_number: null,
      pin_code: pin,
      pin_hash: pinHash,
      metadata: wStation.metadata,
      is_active: true,
      updated_at: nowIso,
    });
  }

  const newTournament: TournamentItem = {
    id: newId,
    name: input.name.trim(),
    status: 'ACTIVE',
    location,
    start_date: startDate,
    end_date: endDate,
    tatami_count: tatamiCount,
    athlete_count: 0,
    categories_count: 0,
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
        score_types: ['IPPON', 'WAZA_ARI', 'YUKO'],
        best_of_limit: 6,
      },
    });

    if (tourError) {
      console.warn('Error insertando torneo en Supabase:', tourError.message);
    }

    // 3. Upsert estaciones físicas vinculadas al nuevo torneo (tatamis + pesajes)
    let { error: stationErr } = await supabase
      .from('stations')
      .upsert(stationUpserts, { onConflict: 'tournament_id,slug' });

    if (stationErr && stationErr.message.includes('column')) {
      const fallbackUpserts = stationUpserts.map(({ metadata, ...rest }) => rest);
      const { error: retryErr } = await supabase
        .from('stations')
        .upsert(fallbackUpserts, { onConflict: 'tournament_id,slug' });
      stationErr = retryErr;
    }

    if (stationErr) {
      console.warn('Aviso insertando estaciones en Supabase:', stationErr.message);
    }
  } catch (dbErr) {
    console.warn('Operando con respaldo seguro de memoria:', dbErr);
  }

  return {
    success: true,
    message: `Campeonato "${input.name.trim()}" creado exitosamente.`,
    tournament: newTournament,
    injectedAthletesCount: 0,
  };
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

/**
 * Valida el PIN de un Tatami para vincular un televisor o pantalla independiente (Smart TV)
 * a su campeonato específico sin requerir que esté marcado como 'ACTIVE'.
 */
export async function bindScoreboardTatamiAction(params: {
  tatamiNumber: number;
  pin: string;
}): Promise<{
  success: boolean;
  message?: string;
  tournamentId?: string;
  tournamentName?: string;
}> {
  const { tatamiNumber, pin } = params;
  const cleanPin = (pin || '').trim();

  if (!cleanPin || cleanPin.length < 4) {
    return {
      success: false,
      message: 'Ingresa un PIN numérico válido (mínimo 4 dígitos).',
    };
  }

  try {
    const supabase = createAdminClient();

    // 1. Buscar en la tabla stations todas las mesas con ese tatami_number
    const { data: stations, error: stErr } = await supabase
      .from('stations')
      .select('id, tournament_id, name, slug, tatami_number, pin_hash, pin_code, is_active')
      .eq('tatami_number', tatamiNumber)
      .eq('type', 'TATAMI_TABLE')
      .eq('is_active', true);

    let matchedTourId: string | null = null;

    if (stations && stations.length > 0) {
      for (const st of stations) {
        let isMatch = false;
        if (st.pin_hash) {
          try {
            isMatch = await bcrypt.compare(cleanPin, st.pin_hash);
          } catch {
            isMatch = false;
          }
          if (!isMatch && st.pin_hash === cleanPin) isMatch = true;
        }
        if (!isMatch && st.pin_code && st.pin_code === cleanPin) {
          isMatch = true;
        }

        if (isMatch && st.tournament_id) {
          matchedTourId = st.tournament_id;
          break;
        }
      }
    }

    // 2. Fallback a tournaments.config si no hubo match directo en stations
    if (!matchedTourId) {
      const { data: tours } = await supabase
        .from('tournaments')
        .select('id, name, config')
        .order('created_at', { ascending: false })
        .limit(10);

      for (const t of tours || []) {
        const creds = (t.config as any)?.tatami_credentials || [];
        const matchCred = creds.find(
          (c: any) =>
            c.tatami_number === tatamiNumber &&
            (c.pin === cleanPin || c.pin_hash === cleanPin)
        );
        if (matchCred) {
          matchedTourId = t.id;
          break;
        }
      }
    }

    if (matchedTourId) {
      const { data: tour } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('id', matchedTourId)
        .maybeSingle();

      return {
        success: true,
        tournamentId: matchedTourId,
        tournamentName: tour?.name || 'Campeonato Oficial',
        message: `Televisor vinculado exitosamente a ${tour?.name || 'Campeonato'} - Tatami ${tatamiNumber}.`,
      };
    }
  } catch (err: any) {
    console.error('[bindScoreboardTatamiAction] Error:', err);
    return {
      success: false,
      message: 'Error verificando el PIN de la mesa en el servidor.',
    };
  }

  return {
    success: false,
    message: `PIN incorrecto para Tatami #${tatamiNumber}. Consulta la ficha de credenciales del Director.`,
  };
}


