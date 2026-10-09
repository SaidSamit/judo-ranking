import { TatamiControlTable } from '@/components/tatami/tatami-control-table';
import { LocalMatch } from '@/lib/offline/db';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

export default async function TatamiPage({ params }: TatamiPageProps) {
  const { id } = await params;

  // Datos base de demostración / iniciales si aún no hay fetch de API
  const mockMatch: LocalMatch = {
    id,
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
