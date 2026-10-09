import { PublicScoreboard } from '@/components/scoreboard/public-scoreboard';
import { BroadcastMatchPayload } from '@/types/events';
import { createInitialScore } from '@/lib/rules/ijf-engine';

interface ScoreboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScoreboardPage({ params }: ScoreboardPageProps) {
  const { id } = await params;

  // Extraer número de tatami si el ID es 'tatami-1' o similar, o usar canal directo
  const tatamiMatch = id.match(/tatami-(\d+)/i);
  const tatamiNumber = tatamiMatch ? parseInt(tatamiMatch[1], 10) : 1;
  const channelName = id.includes('tatami-') ? id : `tatami-${tatamiNumber}`;

  // Estado inicial por defecto mientras se recibe la primera emisión de WebSocket
  const initialPayload: BroadcastMatchPayload = {
    match_id: id,
    tatami_number: tatamiNumber,
    match_number: 1,
    category_name: 'Categoría Oficial',
    white_athlete_name: 'Atleta Blanco',
    white_club_name: 'Club Blanco',
    blue_athlete_name: 'Atleta Azul',
    blue_club_name: 'Club Azul',
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

  return <PublicScoreboard initialPayload={initialPayload} channelName={channelName} />;
}
