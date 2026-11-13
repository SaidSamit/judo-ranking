import React from 'react';
import { redirect } from 'next/navigation';
import { getTournamentsAction } from '@/app/actions/tournaments';
import { Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LiveDefaultPage() {
  const res = await getTournamentsAction();
  const activeTourId =
    res.activeTournamentId ||
    res.tournaments.find((t) => t.is_active || t.status === 'ACTIVE')?.id ||
    res.tournaments[0]?.id;

  if (activeTourId) {
    redirect(`/live/${activeTourId}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md space-y-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-white">No hay campeonatos activos</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          En este momento no hay un campeonato oficial en curso. Cuando el Director inicie las competencias, el monitor multi-tatami se transmitirá aquí en vivo.
        </p>
      </div>
    </main>
  );
}

