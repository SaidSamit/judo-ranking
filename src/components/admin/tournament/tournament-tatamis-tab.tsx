'use client';

import React from 'react';
import { MultiTatamiMonitorView } from '@/components/admin/multi-tatami-monitor-view';

interface TournamentTatamisTabProps {
  tournamentId: string;
  tournamentName: string;
}

export function TournamentTatamisTab({
  tournamentId,
  tournamentName,
}: TournamentTatamisTabProps) {
  return (
    <div className="space-y-4">
      <MultiTatamiMonitorView
        initialTournamentId={tournamentId}
        initialTournamentName={tournamentName}
      />
    </div>
  );
}

