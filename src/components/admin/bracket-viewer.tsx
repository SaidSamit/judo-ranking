// ==============================================================================
// COMPONENTE: VISOR Y EDITOR VISUAL DE LLAVES (BRACKET VIEWER & EDITOR)
// ==============================================================================
//
// REQUERIMIENTOS CUMPLIDOS:
// 1. Visual: Árbol de competición con ramas conectoras estilo torneo oficial.
// 2. Modificable: Permite al Director entrar en "Modo Edición" para intercambiar
//    atletas entre cruces (evitar choques de mismo club o ajustar cabezas de serie)
//    y guardar las modificaciones tanto en memoria como en base de datos.
// 3. Soporta Eliminación Simple, Round Robin (Berger) y Al Mejor de 3.
//
// ==============================================================================

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Users,
  Swords,
  CheckCircle2,
  Sparkles,
  ArrowLeftRight,
  Edit3,
  Save,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { BracketResult, GeneratedMatch } from '@/lib/rules/bracket-engine';

interface BracketViewerProps {
  bracketResult: BracketResult;
  categoryName?: string;
  onSaveModifiedBracket?: (modifiedBracket: BracketResult) => Promise<void> | void;
}

interface SwapSelection {
  matchId: string;
  slot: 'WHITE' | 'BLUE';
  athleteName: string;
  athleteId: string | null;
  clubName?: string;
}

export function BracketViewer({
  bracketResult: initialBracket,
  categoryName,
  onSaveModifiedBracket,
}: BracketViewerProps) {
  // Estado local editable de la llave para permitir modificaciones interactivas
  const [bracket, setBracket] = useState<BracketResult>(initialBracket);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedForSwap, setSelectedForSwap] = useState<SwapSelection | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sincronizar si cambia la prop inicial (por ejemplo al cambiar de categoría)
  useEffect(() => {
    setBracket(initialBracket);
    setIsEditMode(false);
    setSelectedForSwap(null);
    setFeedback(null);
  }, [initialBracket]);

  const { bracket_type, matches, summary } = bracket;

  // ============================================================================
  // AGRUPACIÓN POR RONDAS PARA ELIMINACIÓN SIMPLE
  // ============================================================================
  const singleEliminationRounds = useMemo(() => {
    if (bracket_type !== 'SINGLE_ELIMINATION') return [];

    const roundsMap = new Map<string, GeneratedMatch[]>();
    matches.forEach((m) => {
      const roundKey = m.round;
      if (!roundsMap.has(roundKey)) {
        roundsMap.set(roundKey, []);
      }
      roundsMap.get(roundKey)!.push(m);
    });

    // Ordenar de mayor cantidad de combates a menor (Ronda 1 -> Cuartos -> Semis -> Final)
    const sorted = Array.from(roundsMap.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    return sorted.map(([roundKey, roundMatches]) => {
      let displayName = 'Ronda';
      if (roundKey === 'FINAL') displayName = 'Gran Final 🥇';
      else if (roundKey === 'SF') displayName = 'Semifinales';
      else if (roundKey === 'QF') displayName = 'Cuartos de Final';
      else if (roundKey === 'R16') displayName = 'Octavos de Final';
      else if (roundKey === 'R32') displayName = 'Dieciseisavos';
      else displayName = roundMatches[0]?.round_name?.split('-')[0]?.trim() || roundKey;

      return {
        key: roundKey,
        name: displayName,
        matches: roundMatches,
      };
    });
  }, [bracket_type, matches]);

  // Agrupación para Round Robin
  const roundRobinRounds = useMemo(() => {
    if (bracket_type !== 'ROUND_ROBIN') return [];

    const roundsMap = new Map<string, GeneratedMatch[]>();
    matches.forEach((m) => {
      const matchPrefix = m.round.split('_M')[0] || m.round;
      if (!roundsMap.has(matchPrefix)) {
        roundsMap.set(matchPrefix, []);
      }
      roundsMap.get(matchPrefix)!.push(m);
    });

    return Array.from(roundsMap.entries()).map(([key, rMatches], idx) => ({
      key,
      name: `Ronda ${idx + 1} (Berger)`,
      matches: rMatches,
    }));
  }, [bracket_type, matches]);

  // ============================================================================
  // ACCIONES DE EDICIÓN: INTERCAMBIAR ATLETAS ENTRE SLOTS
  // ============================================================================
  const handleSelectSlotForSwap = (
    matchId: string,
    slot: 'WHITE' | 'BLUE',
    athleteName: string,
    athleteId: string | null,
    clubName?: string
  ) => {
    if (!isEditMode) return;

    // Si ya había uno seleccionado, ejecutamos el intercambio (Swap)
    if (selectedForSwap) {
      if (selectedForSwap.matchId === matchId && selectedForSwap.slot === slot) {
        // Deseleccionar si hace clic sobre el mismo
        setSelectedForSwap(null);
        return;
      }

      // Realizar intercambio en la lista de combates
      const updatedMatches = bracket.matches.map((m) => {
        const newMatch = { ...m };

        // Slot de origen
        if (m.id === selectedForSwap.matchId) {
          if (selectedForSwap.slot === 'WHITE') {
            newMatch.white_athlete_name = athleteName;
            newMatch.white_athlete_id = athleteId;
            newMatch.white_club_name = clubName;
          } else {
            newMatch.blue_athlete_name = athleteName;
            newMatch.blue_athlete_id = athleteId;
            newMatch.blue_club_name = clubName;
          }
        }

        // Slot de destino
        if (m.id === matchId) {
          if (slot === 'WHITE') {
            newMatch.white_athlete_name = selectedForSwap.athleteName;
            newMatch.white_athlete_id = selectedForSwap.athleteId;
            newMatch.white_club_name = selectedForSwap.clubName;
          } else {
            newMatch.blue_athlete_name = selectedForSwap.athleteName;
            newMatch.blue_athlete_id = selectedForSwap.athleteId;
            newMatch.blue_club_name = selectedForSwap.clubName;
          }
        }

        return newMatch;
      });

      setBracket({
        ...bracket,
        matches: updatedMatches,
      });

      setFeedback(
        `¡Intercambio realizado! Se cambiaron las posiciones de "${selectedForSwap.athleteName}" y "${athleteName}".`
      );
      setSelectedForSwap(null);
    } else {
      // Primer clic: seleccionar atleta de origen
      setSelectedForSwap({
        matchId,
        slot,
        athleteName,
        athleteId,
        clubName,
      });
      setFeedback(`Seleccionado "${athleteName}". Ahora haz clic en otro competidor para intercambiarlos.`);
    }
  };

  // Guardar modificaciones
  const handleSaveModifications = async () => {
    setIsSaving(true);
    try {
      if (onSaveModifiedBracket) {
        await onSaveModifiedBracket(bracket);
      }
      setIsEditMode(false);
      setSelectedForSwap(null);
      setFeedback('¡Modificaciones de la llave guardadas exitosamente!');
    } catch (err: any) {
      setFeedback(`Error guardando llave: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetModifications = () => {
    setBracket(initialBracket);
    setSelectedForSwap(null);
    setIsEditMode(false);
    setFeedback('Llave restablecida a su sorteo original.');
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 font-sans">
      {/* CABECERA DEL VISOR Y ACCIONES DEL DIRECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              {categoryName || 'Cuadro de Competición'}
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold uppercase ${
                bracket_type === 'BEST_OF_3'
                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                  : bracket_type === 'ROUND_ROBIN'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-blue-950 text-blue-300 border border-blue-800'
              }`}
            >
              {bracket_type === 'BEST_OF_3'
                ? 'Al Mejor de 3'
                : bracket_type === 'ROUND_ROBIN'
                ? 'Round Robin'
                : 'Eliminación Simple'}
            </span>

            {isEditMode && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold animate-pulse">
                Modo Edición Activo
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{summary.description}</p>
        </div>

        {/* BOTONES DE MODO MODIFICABLE (REQUERIMIENTO: VISUAL Y MODIFICABLE) */}
        <div className="flex items-center space-x-2">
          {!isEditMode ? (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center space-x-1.5 shadow"
              title="Permite intercambiar atletas de posición en la llave"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Modificar Cruces</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveModifications}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetModifications}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition flex items-center space-x-1"
                title="Deshacer cambios y volver al sorteo original"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BANNER DE INSTRUCCIONES DE EDICIÓN O FEEDBACK */}
      {isEditMode && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {selectedForSwap
                ? `Haz clic sobre otro atleta para intercambiarlo con "${selectedForSwap.athleteName}".`
                : 'Modo Intercambio: Haz clic sobre cualquier atleta para moverlo de cruce.'}
            </span>
          </div>
          {selectedForSwap && (
            <button
              onClick={() => setSelectedForSwap(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-white underline"
            >
              Cancelar Selección
            </button>
          )}
        </div>
      )}

      {feedback && !isEditMode && (
        <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* CASO 1: ÁRBOL VISUAL DE ELIMINACIÓN SIMPLE CON RAMAS CONECTORAS */}
      {bracket_type === 'SINGLE_ELIMINATION' && (
        <div className="overflow-x-auto pb-6 pt-2">
          <div className="flex flex-row items-stretch min-w-[850px] p-2">
            {singleEliminationRounds.map((round, rIdx) => {
              const isLastRound = rIdx === singleEliminationRounds.length - 1;

              return (
                <React.Fragment key={round.key}>
                  {/* Columna de la Ronda */}
                  <div className="flex-1 flex flex-col min-w-[270px] max-w-[320px]">
                    {/* Título de la Ronda */}
                    <div className="text-center font-black text-xs uppercase tracking-wider text-amber-400 pb-3 mb-4 flex items-center justify-center space-x-1.5 border-b border-slate-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{round.name}</span>
                    </div>

                    {/* Combates de la Ronda distribuidos equitativamente para alinear con la siguiente */}
                    <div className="flex-1 flex flex-col justify-around gap-6 py-2">
                      {round.matches.map((match) => (
                        <div key={match.id} className="relative">
                          <InteractiveMatchCard
                            match={match}
                            isEditMode={isEditMode}
                            selectedForSwap={selectedForSwap}
                            onSelectSlot={handleSelectSlotForSwap}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RAMA CONECTORA DE TORNEO (ESTILO TREE BRACKET) */}
                  {!isLastRound && (
                    <div className="w-8 flex flex-col justify-around py-12 relative flex-shrink-0">
                      {/* Generar conectores en horquilla por cada par de combates */}
                      {Array.from({ length: Math.ceil(round.matches.length / 2) }).map(
                        (_, pairIdx) => (
                          <div
                            key={`connector-${rIdx}-${pairIdx}`}
                            className="flex-1 flex items-center justify-center relative my-4"
                          >
                            {/* Línea vertical que une el combate superior con el inferior */}
                            <div className="w-full h-full border-r-2 border-t-2 border-b-2 border-slate-700/80 rounded-r-lg" />
                            {/* Línea horizontal que apunta hacia el combate de la siguiente ronda */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-slate-700/80" />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* CASO 2: MODALIDAD ROUND ROBIN (ALGORITMO DE BERGER) */}
      {bracket_type === 'ROUND_ROBIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roundRobinRounds.map((rRound) => (
              <div
                key={rRound.key}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-2">
                  {rRound.name}
                </div>
                <div className="space-y-3">
                  {rRound.matches.map((match) => (
                    <InteractiveMatchCard
                      key={match.id}
                      match={match}
                      isEditMode={isEditMode}
                      selectedForSwap={selectedForSwap}
                      onSelectSlot={handleSelectSlotForSwap}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CASO 3: MODALIDAD AL MEJOR DE 3 (BEST OF 3) */}
      {bracket_type === 'BEST_OF_3' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {matches.map((match, idx) => (
            <div
              key={match.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Combate #{idx + 1} {idx === 2 ? '(Si es necesario)' : ''}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  Tatami #{match.tatami_number}
                </span>
              </div>
              <InteractiveMatchCard
                match={match}
                isEditMode={isEditMode}
                selectedForSwap={selectedForSwap}
                onSelectSlot={handleSelectSlotForSwap}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta individual interactiva y modificable para el Director
 */
function InteractiveMatchCard({
  match,
  isEditMode,
  selectedForSwap,
  onSelectSlot,
}: {
  match: GeneratedMatch;
  isEditMode: boolean;
  selectedForSwap: SwapSelection | null;
  onSelectSlot: (
    matchId: string,
    slot: 'WHITE' | 'BLUE',
    name: string,
    id: string | null,
    club?: string
  ) => void;
}) {
  const isBye =
    match.white_athlete_name.includes('Bye') ||
    match.blue_athlete_name.includes('Bye');

  const isWhiteSelected =
    selectedForSwap?.matchId === match.id && selectedForSwap?.slot === 'WHITE';
  const isBlueSelected =
    selectedForSwap?.matchId === match.id && selectedForSwap?.slot === 'BLUE';

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-lg transition space-y-2">
      {/* Cabecera del combate */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-b border-slate-800/80 pb-1.5">
        <span className="font-bold text-slate-300">
          Combate #{match.match_number}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            match.status === 'SCHEDULED'
              ? 'bg-blue-950 text-blue-400 border border-blue-900'
              : match.status === 'PENDING'
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : match.status === 'FINISHED'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {match.status === 'PENDING' ? 'EN ESPERA' : match.status}
        </span>
      </div>

      {/* Slot Blanco (White Judogi) */}
      <div
        onClick={() => {
          if (isEditMode) {
            onSelectSlot(
              match.id,
              'WHITE',
              match.white_athlete_name,
              match.white_athlete_id,
              match.white_club_name
            );
          }
        }}
        className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition ${
          isWhiteSelected
            ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
            : isEditMode
            ? 'cursor-pointer hover:bg-slate-800/80 border-slate-700'
            : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <span className="w-2.5 h-2.5 rounded-full bg-white shadow flex-shrink-0" />
          <div className="truncate">
            <span className="text-xs font-bold text-white block truncate">
              {match.white_athlete_name}
            </span>
            {match.white_club_name && (
              <span className="text-[10px] text-slate-400 block truncate">
                {match.white_club_name}
              </span>
            )}
          </div>
        </div>

        {isEditMode && (
          <span
            className={`p-1 rounded text-[10px] font-mono transition flex-shrink-0 ${
              isWhiteSelected
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
            title="Hacer clic para intercambiar"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </span>
        )}
      </div>

      {/* Separador VS */}
      <div className="text-[9px] text-slate-500 font-black tracking-widest text-center uppercase">
        VS
      </div>

      {/* Slot Azul (Blue Judogi) */}
      <div
        onClick={() => {
          if (isEditMode) {
            onSelectSlot(
              match.id,
              'BLUE',
              match.blue_athlete_name,
              match.blue_athlete_id,
              match.blue_club_name
            );
          }
        }}
        className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition ${
          isBlueSelected
            ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
            : isEditMode
            ? 'cursor-pointer hover:bg-slate-800/80 border-slate-700'
            : 'bg-slate-950/70 border-blue-950/80'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow flex-shrink-0" />
          <div className="truncate">
            <span className="text-xs font-bold text-white block truncate">
              {match.blue_athlete_name}
            </span>
            {match.blue_club_name && (
              <span className="text-[10px] text-slate-400 block truncate">
                {match.blue_club_name}
              </span>
            )}
          </div>
        </div>

        {isEditMode && (
          <span
            className={`p-1 rounded text-[10px] font-mono transition flex-shrink-0 ${
              isBlueSelected
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
            title="Hacer clic para intercambiar"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </span>
        )}
      </div>

      {isBye && (
        <div className="text-[10px] text-center text-emerald-400 font-mono font-bold bg-emerald-950/40 rounded py-0.5 border border-emerald-900/60">
          Pase Directo (Bye)
        </div>
      )}
    </div>
  );
}
