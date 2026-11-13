// ==============================================================================
// COMPONENTE COMPARTIDO: TARJETA DE COMBATE DE TATAMI (TATAMI MATCH CARD)
// ==============================================================================
//
// Estándar Profesional de Judo (IJF / Smoothcomp / JudoManager):
// 1. Franjas oficiales de Judogi Blanco y Azul de 4px con chips "BLANCO" y "AZUL".
// 2. Nomenclatura oficial de llamado:
//    - EN TATAMI AHORA (Borde ámbar/naranja institucional, fondo cálido, icono Sparkles).
//    - A CONTINUACIÓN (Siguiente a entrar, azul neón pulsante).
//    - EN 2 COMBATES (Calentamiento activo).
//    - EN N COMBATES (Programación en cascada).
// 3. Resaltado de búsqueda personal con chip "TÚ" en el judoka correspondiente.
// 4. Soporte opcional para llamada a tatami en panel del director.
//
// ==============================================================================

'use client';

import React from 'react';
import { Sparkles, Play } from 'lucide-react';
import { MultiTatamiMatch } from '@/app/actions/brackets';

export interface TatamiMatchCardProps {
  match: MultiTatamiMatch;
  isActive?: boolean;
  isHighlighted?: boolean;
  userSlot?: 'WHITE' | 'BLUE' | 'BOTH' | 'NONE';
  showCallButton?: boolean;
  onCallMatch?: (matchId: string) => void;
  className?: string;
}

export function TatamiMatchCard({
  match,
  isActive = false,
  isHighlighted = false,
  userSlot = 'NONE',
  showCallButton = false,
  onCallMatch,
  className = '',
}: TatamiMatchCardProps) {
  // ============================================================================
  // CASO A: COMBATE EN TATAMI AHORA (ACTIVO)
  // ============================================================================
  if (isActive) {
    return (
      <div
        className={`border-2 rounded-2xl p-3.5 space-y-2.5 shadow-xl relative overflow-hidden transition ${
          isHighlighted
            ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400/50'
            : 'border-amber-500/80 bg-amber-950/25'
        } ${className}`}
      >
        {/* BADGE OFICIAL ÁMBAR Y NÚMERO DE ORDEN */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center space-x-1 shadow">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>EN TATAMI AHORA</span>
          </span>
          <span className="text-xs sm:text-sm font-mono font-black text-amber-400">
            Orden #{match.match_number}
          </span>
        </div>

        {/* CATEGORÍA Y RONDA */}
        <div className="space-y-0.5">
          <span className="text-xs sm:text-sm font-black text-white block leading-tight">
            {match.category_name}
          </span>
          <span className="text-[11px] text-amber-300 font-semibold block">
            {match.round_name}
          </span>
        </div>

        {/* COMBATIENTES CON FRANJAS OFICIALES BLANCO VS AZUL */}
        <div className="space-y-1.5 pt-0.5">
          {/* JUDOKA BLANCO */}
          <div
            className={`flex items-center justify-between p-2 rounded-xl border border-l-4 transition ${
              userSlot === 'WHITE' || userSlot === 'BOTH'
                ? 'border-l-white bg-slate-800 border-slate-600'
                : 'border-l-white bg-slate-950/90 border-slate-800'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-white text-slate-950 shrink-0">
                BLANCO
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {match.white_athlete_name}
              </span>
              {(userSlot === 'WHITE' || userSlot === 'BOTH') && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                  TÚ
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0 ml-2">
              {match.white_club_name}
            </span>
          </div>

          {/* JUDOKA AZUL */}
          <div
            className={`flex items-center justify-between p-2 rounded-xl border border-l-4 transition ${
              userSlot === 'BLUE' || userSlot === 'BOTH'
                ? 'border-l-blue-600 bg-slate-800 border-blue-900'
                : 'border-l-blue-600 bg-slate-950/90 border-slate-800'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-600 text-white shrink-0">
                AZUL
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {match.blue_athlete_name}
              </span>
              {(userSlot === 'BLUE' || userSlot === 'BOTH') && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                  TÚ
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0 ml-2">
              {match.blue_club_name}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // CASO B: COMBATE EN COLA / PROGRAMADO (UPCOMING)
  // ============================================================================
  const isNext = match.matchesUntilStart === 1;
  const isPendingWinner = match.status === 'PENDING';

  let badgeText = '';
  let badgeColor = '';

  if (isNext) {
    badgeText = 'A CONTINUACIÓN';
    badgeColor = 'bg-blue-950 text-blue-300 border-blue-700 font-black animate-pulse';
  } else if (match.matchesUntilStart === 2) {
    badgeText = 'EN 2 COMBATES';
    badgeColor = 'bg-slate-800 text-slate-200 border-slate-700 font-bold';
  } else {
    badgeText = `EN ${match.matchesUntilStart} COMBATES`;
    badgeColor = 'bg-slate-950 text-slate-400 border-slate-800 font-medium';
  }

  return (
    <div
      className={`border rounded-2xl p-2.5 sm:p-3 space-y-2 transition ${
        isHighlighted
          ? 'border-amber-400/90 bg-slate-900 shadow-md'
          : isNext
          ? 'border-blue-600/70 bg-slate-950/90 shadow-md'
          : isPendingWinner
          ? 'border-slate-800/60 bg-slate-950/40 opacity-70'
          : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
      } ${className}`}
    >
      {/* FILA DE CONTEO Y ORDEN */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
          {badgeText}
        </span>
        <span className="text-xs font-mono font-bold text-slate-400">
          #{match.match_number}
        </span>
      </div>

      {/* CATEGORÍA Y RONDA */}
      <div className="space-y-0.5">
        <span className="text-xs font-bold text-white block truncate">
          {match.category_name}
        </span>
        <span className="text-[11px] text-amber-400/90 font-medium block truncate">
          {match.round_name}
        </span>
      </div>

      {/* ATLETAS CON FRANJAS BLANCO Y AZUL */}
      <div className="space-y-1">
        {/* BLANCO */}
        <div
          className={`flex items-center justify-between px-2 py-1 rounded-lg border border-l-4 transition ${
            userSlot === 'WHITE' || userSlot === 'BOTH'
              ? 'border-l-white bg-slate-800 border-slate-600'
              : 'border-l-white bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-white text-slate-950 shrink-0">
              BLANCO
            </span>
            <span className="text-[11px] font-bold text-white truncate">
              {match.white_athlete_name}
            </span>
            {(userSlot === 'WHITE' || userSlot === 'BOTH') && (
              <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                TÚ
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
            {match.white_club_name}
          </span>
        </div>

        {/* AZUL */}
        <div
          className={`flex items-center justify-between px-2 py-1 rounded-lg border border-l-4 transition ${
            userSlot === 'BLUE' || userSlot === 'BOTH'
              ? 'border-l-blue-600 bg-slate-800 border-blue-900'
              : 'border-l-blue-600 bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-blue-600 text-white shrink-0">
              AZUL
            </span>
            <span className="text-[11px] font-bold text-white truncate">
              {match.blue_athlete_name}
            </span>
            {(userSlot === 'BLUE' || userSlot === 'BOTH') && (
              <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                TÚ
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
            {match.blue_club_name}
          </span>
        </div>
      </div>

      {/* ACCIÓN OPCIONAL DE DIRECTOR: LLAMAR A MESA */}
      {showCallButton && onCallMatch && !isPendingWinner && (
        <button
          type="button"
          onClick={() => onCallMatch(match.id)}
          className="w-full py-1 mt-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition flex items-center justify-center space-x-1"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Llamar a Tatami</span>
        </button>
      )}
    </div>
  );
}

