import { TatamiControlTable } from '@/components/tatami/tatami-control-table';
import { LocalMatch } from '@/lib/offline/db';
import { isValidUuid } from '@/lib/utils/uuid';
import { getMatchByIdAction, getTatamiQueueMatchesAction } from '@/app/actions/brackets';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

const DEMO_MATCH_UUID = '10000000-0000-0000-0000-000000000001';

export default async function TatamiPage({ params }: TatamiPageProps) {
  const { id } = await params;

  let loadedMatch: LocalMatch | null = null;

  // 1. Si el parámetro es un UUID de combate específico (ej: desde "Llamar a Tatami")
  if (isValidUuid(id)) {
    const res = await getMatchByIdAction(id);
    if (res.success && res.match) {
      loadedMatch = res.match;
    }
  } else {
    // 2. Si el parámetro es un número o slug de tatami (ej: /tatami/1 o /tatami/tatami-1)
    const tatamiNum = parseInt(id.replace(/\D/g, '') || '1', 10);
    const queueRes = await getTatamiQueueMatchesAction(tatamiNum);
    if (queueRes.success && queueRes.matches.length > 0) {
      // Tomar el primer combate pendiente/programado en la cola
      const firstScheduled =
        queueRes.matches.find((m: any) => m.status === 'SCHEDULED' || m.status === 'ONGOING') ||
        queueRes.matches[0];

      if (firstScheduled) {
        loadedMatch = {
          id: firstScheduled.id,
          tournament_id: 'e0000000-0000-0000-0000-000000000001',
          category_id: firstScheduled.category?.id || 'f0000000-0000-0000-0000-000000000001',
          category_name: firstScheduled.category?.name || 'Categoría Oficial',
          tatami_number: firstScheduled.tatami_number,
          match_number: firstScheduled.match_number,
          white_athlete_name: firstScheduled.white_athlete
            ? `${firstScheduled.white_athlete.first_name} ${firstScheduled.white_athlete.last_name}`
            : 'Atleta Blanco',
          white_club_name: firstScheduled.white_athlete?.club?.name || 'Independiente',
          blue_athlete_name: firstScheduled.blue_athlete
            ? `${firstScheduled.blue_athlete.first_name} ${firstScheduled.blue_athlete.last_name}`
            : 'Atleta Azul',
          blue_club_name: firstScheduled.blue_athlete?.club?.name || 'Independiente',
          match_duration_seconds: firstScheduled.category?.match_duration_seconds || 240,
          status: firstScheduled.status || 'SCHEDULED',
          current_time_seconds: 0,
          updated_at: new Date().toISOString(),
        };
      }
    }
  }

  // 3. Fallback en caso de que no haya combate en la base de datos aún
  const resolvedMatch: LocalMatch = loadedMatch || {
    id: isValidUuid(id) ? id : DEMO_MATCH_UUID,
    tournament_id: 'e0000000-0000-0000-0000-000000000001',
    category_id: 'f0000000-0000-0000-0000-000000000001',
    category_name: 'Cadetes (Sub-18) Masculino -60kg',
    tatami_number: 1,
    match_number: 1,
    white_athlete_name: 'Carlos Muñoz',
    white_club_name: 'Club de Judo Hiroshima',
    blue_athlete_name: 'Matías Silva',
    blue_club_name: 'Judo Club Alto Hospicio',
    match_duration_seconds: 240,
    status: 'SCHEDULED',
    current_time_seconds: 0,
    updated_at: new Date().toISOString(),
  };

  return <TatamiControlTable initialMatch={resolvedMatch} />;
}
