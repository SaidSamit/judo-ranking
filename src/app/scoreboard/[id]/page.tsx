import { PublicScoreboard } from '@/components/scoreboard/public-scoreboard';
import { BroadcastMatchPayload } from '@/types/events';
import { createInitialScore } from '@/lib/rules/ijf-engine';
import { getTatamiQueueMatchesAction } from '@/app/actions/brackets';
import { createAdminClient } from '@/lib/supabase/admin';

interface ScoreboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScoreboardPage({ params }: ScoreboardPageProps) {
  const { id } = await params;

  // Extraer número de tatami si el ID es 'tatami-1' o similar, o usar canal directo
  const tatamiMatch = id.match(/tatami-(\d+)/i);
  const tatamiNumber = tatamiMatch ? parseInt(tatamiMatch[1], 10) : 1;
  const channelName = id.includes('tatami-') ? id : `tatami-${tatamiNumber}`;

  // Consultar si hay un combate activo o programado en este tatami para precargar nombres reales
  let initialMatchData: any = null;
  try {
    const supabase = createAdminClient();
    const { data: activeTour } = await supabase
      .from('tournaments')
      .select('id')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const queueRes = await getTatamiQueueMatchesAction(tatamiNumber, activeTour?.id);
    if (queueRes.success && queueRes.matches.length > 0) {
      initialMatchData =
        queueRes.matches.find((m: any) => m.status === 'ONGOING') ||
        queueRes.matches.find((m: any) => m.status === 'SCHEDULED') ||
        queueRes.matches[0];
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

  return <PublicScoreboard initialPayload={initialPayload} channelName={channelName} />;
}
