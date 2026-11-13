'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MultiTatamiMonitorView } from '@/components/admin/multi-tatami-monitor-view';
import { Tv, Share2, Check, ExternalLink } from 'lucide-react';

interface TournamentTatamisTabProps {
  tournamentId: string;
  tournamentName: string;
}

export function TournamentTatamisTab({
  tournamentId,
  tournamentName,
}: TournamentTatamisTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPublicLink = async () => {
    try {
      const publicUrl = `${window.location.origin}/live/${tournamentId}`;
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback si clipboard API no estuviera disponible
      prompt('Copia el enlace público del monitor:', `${window.location.origin}/live/${tournamentId}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* BARRA DE ACCESO PÚBLICO Y TRANSMISIÓN TV */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">
              Transmisión Pública en Vivo (TV & Móviles)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enlace limpio sin controles de administración, optimizado para proyectar en Smart TV o compartir con competidores.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Link
            href={`/live/${tournamentId}`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow flex items-center space-x-1.5"
          >
            <Tv className="w-4 h-4" />
            <span>Pantalla TV en Vivo</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </Link>

          <button
            type="button"
            onClick={handleCopyPublicLink}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 ${
              copied
                ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>¡Enlace Copiado!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copiar Enlace</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MONITOR ADMINISTRATIVO MULTI-TATAMI (CON HERRAMIENTAS DE DIRECTOR) */}
      <MultiTatamiMonitorView
        initialTournamentId={tournamentId}
        initialTournamentName={tournamentName}
      />
    </div>
  );
}
