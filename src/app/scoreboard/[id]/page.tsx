import { PublicScoreboard } from '@/components/scoreboard/public-scoreboard';
import { BroadcastMatchPayload } from '@/types/events';
import { createInitialScore } from '@/lib/rules/ijf-engine';
import { getTatamiQueueMatchesAction } from '@/app/actions/brackets';
import { createAdminClient } from '@/lib/supabase/admin';

interface ScoreboardPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; tournament_id?: string }>;
}

export default async function ScoreboardPage({ params, searchParams }: ScoreboardPageProps) {
  const { id } = await params;
  const { t, tournament_id } = await searchParams;
  const explicitTourId = t || tournament_id;

  // 0. Modo Demostración aislado: conectar exclusivamente al canal 'tatami-demo' sin consultar campeonatos reales
  if (id.toLowerCase() === 'demo') {
    const demoPayload: BroadcastMatchPayload = {
      match_id: 'demo-match',
      tatami_number: 0,
      match_number: 0,
      category_name: 'Mesa de Demostración (Modo Práctica)',
      white_athlete_name: 'Judoka Blanco (Demo)',
      white_club_name: 'Club Shiai',
      blue_athlete_name: 'Judoka Azul (Demo)',
      blue_club_name: 'Club Nippon',
      match_time_remaining: 240,
      match_duration_seconds: 240,
      is_clock_running: false,
      active_osaekomi: null,
      osaekomi_seconds: 0,
      is_golden_score: false,
      match_status: 'SCHEDULED',
      projection: {
        white_score: createInitialScore(),
        blue_score: createInitialScore(),
        is_clock_running: false,
        active_osaekomi: null,
        osaekomi_seconds: 0,
        winner: null,
        win_reason: null,
        is_mathematical_victory: false,
        has_direct_hansoku_make: false,
        direct_hansoku_target: null,
      },
      timestamp: Date.now(),
    };

    return (
      <PublicScoreboard
        initialPayload={demoPayload}
        channelName="tatami-demo"
        tatamiNumber={0}
        isDemoMode={true}
      />
    );
  }

  // Extraer número de tatami si el ID es 'tatami-1' o similar
  const tatamiMatch = id.match(/tatami-(\d+)/i);
  const tatamiNumber = tatamiMatch ? parseInt(tatamiMatch[1], 10) : 1;

  // Consultar si hay un combate activo o programado en este tatami para precargar nombres reales
  let initialMatchData: any = null;
  let tournamentName = 'Campeonato Oficial';

  try {
    const supabase = createAdminClient();
    let targetTourId = explicitTourId;

    if (targetTourId) {
      const { data: tour } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('id', targetTourId)
        .maybeSingle();

      if (tour) {
        tournamentName = tour.name;
      }
    } else {
      // Si no se especificó en la URL, tomar el torneo más reciente registrado
      const { data: recentTour } = await supabase
        .from('tournaments')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentTour) {
        targetTourId = recentTour.id;
        tournamentName = recentTour.name;
      }
    }

    if (targetTourId) {
      const queueRes = await getTatamiQueueMatchesAction(tatamiNumber, targetTourId);
      if (queueRes.success && queueRes.matches.length > 0) {
        initialMatchData =
          queueRes.matches.find((m: any) => m.status === 'ONGOING') ||
          queueRes.matches.find((m: any) => m.status === 'SCHEDULED') ||
          queueRes.matches[0];
      }
    }
  } catch (err) {
    console.warn('[ScoreboardPage] Error precargando combate inicial:', err);
  }

  const whiteName = initialMatchData?.white_athlete
    ? `${initialMatchData.white_athlete.first_name} ${initialMatchData.white_athlete.last_name}`
    : initialMatchData?.white_athlete_name || 'Por definir';
  const whiteClub =
    initialMatchData?.white_athlete?.club?.name ||
    initialMatchData?.white_club_name ||
    'Club';

  const blueName = initialMatchData?.blue_athlete
    ? `${initialMatchData.blue_athlete.first_name} ${initialMatchData.blue_athlete.last_name}`
    : initialMatchData?.blue_athlete_name || 'Por definir';
  const blueClub =
    initialMatchData?.blue_athlete?.club?.name ||
    initialMatchData?.blue_club_name ||
    'Club';

  const durationSec =
    initialMatchData?.category?.match_duration_seconds || 240;

  // Estado inicial precargado directamente desde la base de datos
  const initialPayload: BroadcastMatchPayload = {
    match_id: initialMatchData?.id || id,
    tatami_number: tatamiNumber,
    match_number: initialMatchData?.match_number || 1,
    category_name: initialMatchData?.category?.name || 'Categoría Oficial',
    white_athlete_name: whiteName,
    white_club_name: whiteClub,
    blue_athlete_name: blueName,
    blue_club_name: blueClub,
    match_time_remaining: durationSec,
    match_duration_seconds: durationSec,
    is_clock_running: initialMatchData?.status === 'ONGOING',
    active_osaekomi: null,
    osaekomi_seconds: 0,
    is_golden_score: false,
    match_status: initialMatchData?.status || 'SCHEDULED',
    projection: {
      white_score: createInitialScore(),
      blue_score: createInitialScore(),
      is_clock_running: false,
      active_osaekomi: null,
      osaekomi_seconds: 0,
      winner: null,
      win_reason: null,
      is_mathematical_victory: false,
      has_direct_hansoku_make: false,
      direct_hansoku_target: null,
    },
    timestamp: Date.now(),
  };

  const channelName = explicitTourId
    ? `tatami-${tatamiNumber}-${explicitTourId}`
    : `tatami-${tatamiNumber}`;

  return (
    <PublicScoreboard
      initialPayload={initialPayload}
      channelName={channelName}
      tatamiNumber={tatamiNumber}
      initialTournamentId={explicitTourId}
      initialTournamentName={tournamentName}
    />
  );
}
