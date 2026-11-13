// ==============================================================================
// COMPONENTE COMPARTIDO: COLUMNA DE TATAMI INDIVIDUAL (TATAMI COLUMN CARD)
// ==============================================================================
//
// Usado en:
// 1. Panel del Director (/admin/tournaments/[id]?tab=tatamis y /admin/tatami/[id])
//    con showAdminActions={true} (botones Mover, Mesa y TV activos).
// 2. Pantalla Pública en Vivo (/live y /live/[id])
//    con showAdminActions={false} (visualización limpia broadcast sin controles).
//
// ==============================================================================

'use client';

import React from 'react';
import Link from 'next/link';
import {
  Play,
  Tv,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TatamiColumn, MultiTatamiMatch } from '@/app/actions/brackets';
import { TatamiMatchCard } from '@/components/tatami/tatami-match-card';

export interface TatamiColumnCardProps {
  column: TatamiColumn;
  showAdminActions?: boolean;
  totalColumnsCount?: number;
  onOpenTransferModal?: (tatamiNumber: number) => void;
  onCallMatch?: (matchId: string) => void;
  isMatchHighlighted?: (m: MultiTatamiMatch) => boolean;
  getUserSlot?: (m: MultiTatamiMatch) => 'WHITE' | 'BLUE' | 'BOTH' | 'NONE';
  showFinished: boolean;
  onToggleFinished: () => void;
  className?: string;
}

export function TatamiColumnCard({
  column,
  showAdminActions = false,
  totalColumnsCount = 1,
  onOpenTransferModal,
  onCallMatch,
  isMatchHighlighted,
  getUserSlot,
  showFinished,
  onToggleFinished,
  className = '',
}: TatamiColumnCardProps) {
  const countInQueue = column.upcomingMatches.length + (column.activeMatch ? 1 : 0);

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden min-w-[300px] sm:min-w-[320px] ${className}`}
    >
      {/* ============================================================== */}
      {/* CABECERA DE LA COLUMNA DE TATAMI                               */}
      {/* ============================================================== */}
      <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-500/50 animate-pulse flex-shrink-0" />
            <h2 className="text-base sm:text-xl font-black text-white tracking-wider truncate">
              TATAMI #{column.tatamiNumber}
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
            {countInQueue} en cola • {column.finishedMatches.length} finalizado{column.finishedMatches.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* ACCIONES DE ADMINISTRADOR (EXCLUSIVO DEL DIRECTOR) */}
        {showAdminActions && (
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* Botón Transferir Combates Masivo */}
            {column.upcomingMatches.length > 0 && totalColumnsCount > 1 && onOpenTransferModal && (
              <button
                type="button"
                onClick={() => onOpenTransferModal(column.tatamiNumber)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold transition flex items-center space-x-1"
                title={`Transferir combates del Tatami ${column.tatamiNumber} a otro tatami`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Mover</span>
              </button>
            )}

            <Link
              href={`/tatami/${column.tatamiNumber}`}
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition flex items-center space-x-1"
              title="Abrir Mesa de Control"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Mesa</span>
            </Link>

            <Link
              href={`/scoreboard/tatami-${column.tatamiNumber}`}
              target="_blank"
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold transition flex items-center space-x-1"
              title="Abrir Marcador TV"
            >
              <Tv className="w-3 h-3" />
              <span>TV</span>
            </Link>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* CUERPO: COMBATE EN CURSO + COLA DE ESPERA EN CASCADA           */}
      {/* ============================================================== */}
      <div className="p-3 sm:p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
        {/* 1. COMBATE EN TATAMI AHORA (SI EXISTE) */}
        {column.activeMatch && (
          <TatamiMatchCard
            match={column.activeMatch}
            isActive={true}
            isHighlighted={isMatchHighlighted?.(column.activeMatch)}
            userSlot={getUserSlot?.(column.activeMatch)}
          />
        )}

        {/* 2. COMBATES EN ESPERA / COLA EN CASCADA */}
        {column.upcomingMatches.length === 0 && !column.activeMatch ? (
          <div className="py-10 text-center space-y-2 text-slate-500">
            <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500/60" />
            <p className="text-xs font-bold text-slate-300">Cola Completada</p>
            <p className="text-[11px]">No hay combates pendientes en este tatami.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {column.upcomingMatches.map((m) => (
              <TatamiMatchCard
                key={m.id}
                match={m}
                isActive={false}
                isHighlighted={isMatchHighlighted?.(m)}
                userSlot={getUserSlot?.(m)}
                showCallButton={showAdminActions}
                onCallMatch={onCallMatch}
              />
            ))}
          </div>
        )}

        {/* 3. COMBATES FINALIZADOS (ACORDEÓN COLAPSABLE) */}
        {column.finishedMatches.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onToggleFinished}
              className="w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold transition flex items-center justify-between"
            >
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Combates Finalizados ({column.finishedMatches.length})</span>
              </div>
              {showFinished ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showFinished && (
              <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                {column.finishedMatches.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-[10px] space-y-0.5 text-slate-400"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span>Combate #{m.match_number}</span>
                      <span className="text-emerald-400 font-bold">Completado</span>
                    </div>
                    <div className="text-slate-300 font-medium truncate">
                      {m.white_athlete_name} vs {m.blue_athlete_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

