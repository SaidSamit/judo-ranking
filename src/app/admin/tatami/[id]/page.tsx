import React from 'react';
import { TatamiQueueView } from '@/components/admin/tatami-queue-view';
import { getTournamentsAction } from '@/app/actions/tournaments';

interface TatamiPageProps {
  params: Promise<{ id: string }>;
}

export default async function TatamiAdminPage({ params }: TatamiPageProps) {
  const { id } = await params;
  const tatamiNumber = parseInt(id.replace(/\D/g, '') || '1', 10);

  const tourRes = await getTournamentsAction();
  const activeTour = tourRes.tournaments.find((t) => t.is_active) || tourRes.tournaments[0];

  return (
    <TatamiQueueView
      tatamiNumber={tatamiNumber}
      rawId={id}
      tournamentId={activeTour?.id}
      tournamentName={activeTour?.name}
      tatamiCount={activeTour?.tatami_count || 2}
    />
  );
}
