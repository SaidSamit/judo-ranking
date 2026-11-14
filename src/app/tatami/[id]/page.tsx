// ==============================================================================
// RUTA DINÁMICA: MESA DE CONTROL DE TATAMI (/tatami/[id])
// ==============================================================================

import React from 'react';
import { TatamiControlTable } from '@/components/tatami/tatami-control-table';
import { TatamiStandbyView } from '@/components/tatami/tatami-standby-view';
import { LocalMatch } from '@/lib/offline/db';
import { isValidUuid } from '@/lib/utils/uuid';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMatchByIdAction } from '@/app/actions/matches';
import { getTatamiQueueMatchesAction } from '@/app/actions/brackets';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeJwt } from 'jose';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

export default async function TatamiPage({ params }: TatamiPageProps) {
  const { id } = await params;

  // 0. Si el identificador es 'demo', servir la mesa de control de demostración
  // completamente aislada (sin combates del campeonato asignados)
  if (id.toLowerCase() === 'demo') {
    const demoMatch: LocalMatch = {
      id: 'demo-match',
      tournament_id: 'demo',
      category_id: 'demo-category',
      category_name: 'Mesa de Demostración (Modo Práctica)',
      tatami_number: 0,
      match_number: 0,
      white_athlete_name: 'Judoka Blanco (Demo)',
      white_club_name: 'Club Shiai',
      blue_athlete_name: 'Judoka Azul (Demo)',
      blue_club_name: 'Club Nippon',
      white_athlete_id: null,
      blue_athlete_id: null,
      next_match_id: null,
      next_match_slot: null,
      match_duration_seconds: 240,
      status: 'SCHEDULED',
      current_time_seconds: 0,
      updated_at: new Date().toISOString(),
    };

    return <TatamiControlTable initialMatch={demoMatch} isDemoMode={true} />;
  }

  // 1. Verificación de Seguridad: Sólo Directores autenticados o Estaciones con PIN válido
  const cookieStore = await cookies();
  const adminRole = cookieStore.get('judo_admin_role')?.value;
  const stationToken = cookieStore.get('station_token')?.value;

  if (!adminRole && !stationToken) {
    redirect('/?error=station_login_required');
  }

  const tatamiNum = parseInt(id.replace(/\D/g, '') || '1', 10);

  // 2. Extraer el tournament_id directamente del token de sesión de la estación
  let sessionTournamentId: string | undefined;
  if (stationToken) {
    try {
      const payload = decodeJwt(stationToken) as any;
      sessionTournamentId = payload.tournament_id;
    } catch {
      // Ignorar fallo de decodificación
    }
  }

  const supabase = createAdminClient();
  let tournamentData: { id: string; name: string } | null = null;

  // Si la mesa se autenticó con sus credenciales, cargar exclusivamente los datos de SU campeonato
  if (sessionTournamentId) {
    const { data: tour } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('id', sessionTournamentId)
      .maybeSingle();

    if (tour) {
      tournamentData = tour;
    }
  }

  // Fallback solo para administradores navegando sin token de estación
  if (!tournamentData) {
    const { data: activeTour } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    tournamentData = activeTour;
  }

  const effectiveTournamentId = tournamentData?.id;
  const tournamentName = tournamentData?.name || 'Campeonato Oficial de Judo';

  let loadedMatch: LocalMatch | null = null;

  // 3. Si el parámetro es un UUID de combate específico (ej: desde "Llamar a Tatami")
  if (isValidUuid(id)) {
    const res = await getMatchByIdAction(id);
    if (res.success && res.match) {
      loadedMatch = res.match;
    }
  } else {
    // 4. Si el parámetro es un número o slug de tatami (ej: /tatami/1 o /tatami/tatami-1)
    const queueRes = await getTatamiQueueMatchesAction(tatamiNum, effectiveTournamentId);
    if (queueRes.success && queueRes.matches.length > 0) {
      // Tomar el primer combate activo o programado en la cola (priorizando ONGOING si ya fue llamado)
      const firstScheduled =
        queueRes.matches.find((m: any) => m.status === 'ONGOING') ||
        queueRes.matches.find((m: any) => m.status === 'SCHEDULED');

      if (firstScheduled) {
        loadedMatch = {
          id: firstScheduled.id,
          tournament_id: firstScheduled.tournament_id || effectiveTournamentId || '',
          category_id: firstScheduled.category?.id || firstScheduled.category_id || '',
          category_name: firstScheduled.category?.name || 'Categoría Oficial',
          tatami_number: firstScheduled.tatami_number,
          match_number: firstScheduled.match_number,
          white_athlete_name: firstScheduled.white_athlete
            ? `${firstScheduled.white_athlete.first_name} ${firstScheduled.white_athlete.last_name}`
            : firstScheduled.white_athlete_name || 'Atleta Blanco',
          white_club_name: firstScheduled.white_athlete?.club?.name || firstScheduled.white_club_name || 'Independiente',
          blue_athlete_name: firstScheduled.blue_athlete
            ? `${firstScheduled.blue_athlete.first_name} ${firstScheduled.blue_athlete.last_name}`
            : firstScheduled.blue_athlete_name || 'Atleta Azul',
          blue_club_name: firstScheduled.blue_athlete?.club?.name || firstScheduled.blue_club_name || 'Independiente',
          white_athlete_id: firstScheduled.white_athlete_id || firstScheduled.white_athlete?.id || null,
          blue_athlete_id: firstScheduled.blue_athlete_id || firstScheduled.blue_athlete?.id || null,
          next_match_id: firstScheduled.next_match_id || null,
          next_match_slot: firstScheduled.next_match_slot || null,
          match_duration_seconds: firstScheduled.category?.match_duration_seconds || 240,
          status: firstScheduled.status || 'SCHEDULED',
          current_time_seconds: 0,
          updated_at: new Date().toISOString(),
        };
      }
    }
  }

  // 5. Si no hay combate programado en la cola de este tatami, mostrar pantalla de espera oficial
  if (!loadedMatch) {
    return (
      <TatamiStandbyView
        tatamiNumber={tatamiNum}
        tournamentName={tournamentName}
      />
    );
  }

  return <TatamiControlTable initialMatch={loadedMatch} />;
}
