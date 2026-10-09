import { TatamiControlTable } from '@/components/tatami/tatami-control-table';
import { LocalMatch } from '@/lib/offline/db';
import { isValidUuid } from '@/lib/utils/uuid';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

const DEMO_MATCH_UUID = '10000000-0000-0000-0000-000000000001';

export default async function TatamiPage({ params }: TatamiPageProps) {
  const { id } = await params;

  // Si la ruta recibe un slug legible como 'match-1', lo normalizamos a un UUID válido
  // para permitir compatibilidad total con PostgreSQL y Supabase Realtime.
  const resolvedMatchId = isValidUuid(id) ? id : DEMO_MATCH_UUID;

  // Datos base de demostración / iniciales si aún no hay fetch de API
  const mockMatch: LocalMatch = {
    id: resolvedMatchId,
    tournament_id: 'e0000000-0000-0000-0000-000000000001',
    category_id: 'f0000000-0000-0000-0000-000000000001',
    category_name: 'Cadetes Masculino -60kg',
    tatami_number: 1,
    match_number: 1,
    white_athlete_name: 'Carlos Muñoz',
    white_club_name: 'Club Judo Iquique',
    blue_athlete_name: 'Matías Silva',
    blue_club_name: 'Judo Club Alto Hospicio',
    match_duration_seconds: 240, // 4 minutos
    status: 'SCHEDULED',
    current_time_seconds: 0,
    updated_at: new Date().toISOString(),
  };

  return <TatamiControlTable initialMatch={mockMatch} />;
}
