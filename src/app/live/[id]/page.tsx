import React from 'react';
import { getAllTatamisQueueAction } from '@/app/actions/brackets';
import { PublicMultiTatamiMonitor } from '@/components/live/public-multi-tatami-monitor';
import { Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface LivePageProps {
  params: Promise<{ id: string }>;
}

export default async function LiveTournamentPage({ params }: LivePageProps) {
  const { id } = await params;
  const initialData = await getAllTatamisQueueAction(id);

  if (!initialData.success && !initialData.tournamentName) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md space-y-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">Campeonato no encontrado</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            No se pudo cargar la información del torneo con ID <code className="text-amber-400 font-mono">{id}</code>. Verifica el enlace o consulta con la mesa de control del evento.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PublicMultiTatamiMonitor
      tournamentId={id}
      initialTournamentName={initialData.tournamentName}
      initialColumns={initialData.columns}
    />
  );
}

