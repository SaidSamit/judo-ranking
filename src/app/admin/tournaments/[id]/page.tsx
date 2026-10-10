// ==============================================================================
// RUTA DINÁMICA: DASHBOARD DEL TORNEO AISLADO (/admin/tournaments/[id])
// ==============================================================================
//
// REGLA DE ARQUITECTURA (MASTER-DETAIL):
// 1. Desencadena la obtención del torneo específico mediante getTournamentDetailsAction(id).
// 2. Provee aislamiento estricto: toda la gestión (inscritos, pesaje, llaves, tatamis)
//    ocurre únicamente dentro del contexto de este tournament_id.
// 3. Si el ID no existe o no se encuentra, presenta una pantalla amigable de retorno.
//
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertCircle, Trophy } from 'lucide-react';
import { getTournamentDetailsAction } from '@/app/actions/tournaments';
import { TournamentDashboardView } from '@/components/admin/tournament-dashboard-view';

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: TournamentPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const res = await getTournamentDetailsAction(id);

  if (!res.success || !res.tournament) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-black text-white">Campeonato no encontrado</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            El campeonato con identificador <code className="text-amber-400 font-mono">{id}</code> no
            existe o fue removido del sistema.
          </p>

          <div className="pt-4">
            <Link
              href="/admin/tournaments"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Lista de Campeonatos</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <TournamentDashboardView initialTournament={res.tournament} />;
}
