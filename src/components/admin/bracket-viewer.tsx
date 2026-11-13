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

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { BracketResult, GeneratedMatch } from '@/lib/rules/bracket-engine';
import { downloadElementAsPdf } from '@/lib/utils/pdf-downloader';

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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!viewerRef.current) return;
    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf(viewerRef.current, {
        filename: `Llave_${(categoryName || 'Torneo').replace(/[\s/\\:]+/g, '_')}`,
        orientation: 'landscape',
        backgroundColor: '#0f172a',
        fitToPage: true,
      });
    } catch (err) {
      console.error('Error generando PDF de llave:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Sincronizar si cambia la prop inicial (por ejemplo al cambiar de categoría)
  useEffect(() => {
    setBracket(initialBracket);
    setIsEditMode(false);
    setSelectedForSwap(null);
    setFeedback(null);
  }, [initialBracket]);

  const { bracket_type, matches, summary } = bracket;

  // ============================================================================
  // AGRUPACIÓN POR RONDAS PARA ELIMINACIÓN SIMPLE (ÁRBOL PRINCIPAL)
  // ============================================================================
  const singleEliminationRounds = useMemo(() => {
    if (bracket_type !== 'SINGLE_ELIMINATION') return [];

    // Mapeo exhaustivo para cálculo recursivo de orden vertical en el árbol
    const matchesById = new Map<string, GeneratedMatch>();
    matches.forEach((m) => matchesById.set(m.id, m));

    // Función que calcula la posición vertical pura en el árbol (0, 1, 2, ...)
    // - La Gran Final tiene orden 0.
    // - Un combate hijo que entra en slot WHITE tiene orden parentOrder * 2.
    // - Un combate hijo que entra en slot BLUE tiene orden parentOrder * 2 + 1.
    const treeOrderMemo = new Map<string, number>();

    function getMatchTreeOrder(m: GeneratedMatch): number {
      if (treeOrderMemo.has(m.id)) return treeOrderMemo.get(m.id)!;
      if (!m.next_match_id || !matchesById.has(m.next_match_id)) {
        treeOrderMemo.set(m.id, 0);
        return 0;
      }
      const parent = matchesById.get(m.next_match_id)!;
      const parentOrder = getMatchTreeOrder(parent);
      const isBlue = m.next_match_slot === 'BLUE';
      const order = parentOrder * 2 + (isBlue ? 1 : 0);
      treeOrderMemo.set(m.id, order);
      return order;
    }

    const roundsMap = new Map<string, GeneratedMatch[]>();
    matches.forEach((m) => {
      // Excluir rondas de repechaje y disputa de bronce del árbol principal
      if (
        m.round.startsWith('REPECHAGE') ||
        m.round.startsWith('BRONZE')
      ) {
        return;
      }
      const roundKey = m.round;
      if (!roundsMap.has(roundKey)) {
        roundsMap.set(roundKey, []);
      }
      roundsMap.get(roundKey)!.push(m);
    });

    // Orden cronológico oficial del torneo (Ronda 1 -> Cuartos -> Semis -> Final)
    const ROUND_PROGRESSION = ['R64', 'R32', 'R16', 'QF', 'SF', 'FINAL'];
    const sorted = Array.from(roundsMap.entries()).sort((a, b) => {
      const idxA = ROUND_PROGRESSION.indexOf(a[0]);
      const idxB = ROUND_PROGRESSION.indexOf(b[0]);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return b[1].length - a[1].length;
    });

    return sorted.map(([roundKey, roundMatches]) => {
      // Ordenar los combates estrictamente según su posición geométrica en el árbol binario
      // garantizando que Semifinal 1 (Rama A) quede arriba y Semifinal 2 (Rama B) abajo
      roundMatches.sort((a, b) => {
        const orderA = getMatchTreeOrder(a);
        const orderB = getMatchTreeOrder(b);
        if (orderA !== orderB) return orderA - orderB;
        return (a.match_number || 0) - (b.match_number || 0);
      });

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

  // Rondas de Repechaje y Doble Bronce (ubicadas en la sección inferior)
  const repechageTracks = useMemo(() => {
    if (bracket_type !== 'SINGLE_ELIMINATION') return null;

    const rep1 = matches.find((m) => m.round === 'REPECHAGE_1');
    const rep2 = matches.find((m) => m.round === 'REPECHAGE_2');
    const b1 = matches.find((m) => m.round === 'BRONZE_1');
    const b2 = matches.find((m) => m.round === 'BRONZE_2');
    const singleBronze = matches.find((m) => m.round === 'BRONZE');

    if (!rep1 && !rep2 && !b1 && !b2 && !singleBronze) return null;

    return {
      track1: { rep: rep1, bronze: b1 },
      track2: { rep: rep2, bronze: b2 },
      singleBronze,
    };
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

  // Agrupación para modalidad Pool Doble (5 Judokas IJF)
  const doublePoolData = useMemo(() => {
    if (bracket_type !== 'DOUBLE_POOL_5') return null;

    const poolAMatches = matches.filter((m) => m.round.startsWith('DP_POOL_A'));
    const poolBMatch = matches.find((m) => m.round === 'DP_SEMI');
    const finalMatch = matches.find((m) => m.round === 'DP_FINAL');
    const bronzeMatch = matches.find((m) => m.round === 'DP_BRONZE');

    return {
      poolAMatches,
      poolBMatch,
      finalMatch,
      bronzeMatch,
    };
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
    <div
      ref={viewerRef}
      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-100 font-sans"
    >
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
                bracket_type === 'UNCONTESTED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : bracket_type === 'BEST_OF_3'
                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                  : bracket_type === 'ROUND_ROBIN'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : bracket_type === 'DOUBLE_POOL_5'
                  ? 'bg-teal-950 text-teal-300 border border-teal-800'
                  : 'bg-blue-950 text-blue-300 border border-blue-800'
              }`}
            >
              {bracket_type === 'UNCONTESTED'
                ? 'Campeón Directo'
                : bracket_type === 'BEST_OF_3'
                ? 'Al Mejor de 3'
                : bracket_type === 'ROUND_ROBIN'
                ? 'Round Robin'
                : bracket_type === 'DOUBLE_POOL_5'
                ? 'Pool Doble'
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

        {/* ACCIONES DEL DIRECTOR (DESCARGA DE PDF Y MODIFICACIÓN) */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2" data-html2canvas-ignore="true">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center space-x-1.5 shadow cursor-pointer disabled:opacity-50"
            title="Descargar esta llave en un archivo PDF tal como se ve en pantalla"
          >
            {isDownloadingPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </>
            )}
          </button>

          {bracket_type !== 'UNCONTESTED' && (
            <>
              {!isEditMode ? (
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center space-x-1.5 shadow"
                  title="Permite intercambiar judokas de posición en la llave"
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
            </>
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
                ? `Haz clic sobre otro judoka para intercambiarlo con "${selectedForSwap.athleteName}".`
                : 'Modo Intercambio: Haz clic sobre cualquier judoka para moverlo de cruce.'}
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

          {/* SECCIÓN INFERIOR: REPECHAJE Y DISPUTA DE BRONCES (ESTILO REGLAMENTO IJF) */}
          {repechageTracks && (
            <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
                <Swords className="w-4 h-4 text-orange-400" />
                <span>Sistema de Repechaje y Doble Bronce</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {/* Rama Superior (Repechaje 1 -> Bronce A) */}
                {(repechageTracks.track1.rep || repechageTracks.track1.bronze) && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span>Cuadro Superior (Rama A)</span>
                      <span className="text-orange-400 text-[10px]">3° Lugar (Bronce A)</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {repechageTracks.track1.rep && (
                        <div className="flex-1 w-full">
                          <div className="text-[10px] text-slate-400 font-mono mb-1 font-bold">Repechaje 1</div>
                          <InteractiveMatchCard
                            match={repechageTracks.track1.rep}
                            isEditMode={isEditMode}
                            selectedForSwap={selectedForSwap}
                            onSelectSlot={handleSelectSlotForSwap}
                          />
                        </div>
                      )}
                      {repechageTracks.track1.rep && repechageTracks.track1.bronze && (
                        <div className="hidden sm:flex text-slate-600 font-black text-lg">➔</div>
                      )}
                      {repechageTracks.track1.bronze && (
                        <div className="flex-1 w-full">
                          <div className="text-[10px] text-amber-400 font-mono mb-1 font-bold">Disputa por Bronce A</div>
                          <InteractiveMatchCard
                            match={repechageTracks.track1.bronze}
                            isEditMode={isEditMode}
                            selectedForSwap={selectedForSwap}
                            onSelectSlot={handleSelectSlotForSwap}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rama Inferior (Repechaje 2 -> Bronce B) */}
                {(repechageTracks.track2.rep || repechageTracks.track2.bronze) && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span>Cuadro Inferior (Rama B)</span>
                      <span className="text-orange-400 text-[10px]">3° Lugar (Bronce B)</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {repechageTracks.track2.rep && (
                        <div className="flex-1 w-full">
                          <div className="text-[10px] text-slate-400 font-mono mb-1 font-bold">Repechaje 2</div>
                          <InteractiveMatchCard
                            match={repechageTracks.track2.rep}
                            isEditMode={isEditMode}
                            selectedForSwap={selectedForSwap}
                            onSelectSlot={handleSelectSlotForSwap}
                          />
                        </div>
                      )}
                      {repechageTracks.track2.rep && repechageTracks.track2.bronze && (
                        <div className="hidden sm:flex text-slate-600 font-black text-lg">➔</div>
                      )}
                      {repechageTracks.track2.bronze && (
                        <div className="flex-1 w-full">
                          <div className="text-[10px] text-amber-400 font-mono mb-1 font-bold">Disputa por Bronce B</div>
                          <InteractiveMatchCard
                            match={repechageTracks.track2.bronze}
                            isEditMode={isEditMode}
                            selectedForSwap={selectedForSwap}
                            onSelectSlot={handleSelectSlotForSwap}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CASO: MODALIDAD POOL DOBLE (5 JUDOKAS IJF) - INTERFAZ MODERNA Y LIMPIA */}
      {bracket_type === 'DOUBLE_POOL_5' && doublePoolData && (
        <div className="space-y-6 pb-6 pt-2">
          {/* FASE 1: CLASIFICACIÓN POR POOLS (POOLS A Y B EN PARALELO) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Fase Clasificatoria • Grupos A y B
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Modalidad Pool Doble (5 Judokas)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pool A (Round Robin - 3 Judokas) */}
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-amber-500/20 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shadow" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Pool A (Round Robin • 3 Judokas)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300/90 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 self-start sm:self-auto">
                    1° ➔ Gran Final • 2° ➔ Bronce
                  </span>
                </div>

                <div className="space-y-2.5">
                  {doublePoolData.poolAMatches.map((match) => (
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

              {/* Pool B (Semifinal Directa - 2 Judokas) */}
              <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 shadow-lg space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 shadow" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Pool B (Semifinal Directa • 2 Judokas)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300/90 font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 self-start sm:self-auto">
                      Ganador ➔ Gran Final • Perdedor ➔ Bronce
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {doublePoolData.poolBMatch && (
                      <InteractiveMatchCard
                        match={doublePoolData.poolBMatch}
                        isEditMode={isEditMode}
                        selectedForSwap={selectedForSwap}
                        onSelectSlot={handleSelectSlotForSwap}
                      />
                    )}
                  </div>
                </div>

                {/* Tarjeta informativa limpia */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs flex items-start space-x-2.5 mt-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    El ganador del Pool B clasifica a disputar el <strong className="text-amber-400">Oro</strong> en la Gran Final, y el perdedor pasa a disputar el <strong className="text-orange-400">Bronce</strong> oficial.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FASE 2: FASE FINAL POR MEDALLAS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Fase Final por Medallas 🏆
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Combates Decisivos por el Podio
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Gran Final (1° y 2° Lugar - Oro y Plata) */}
              <div className="bg-gradient-to-b from-amber-950/20 to-slate-950/80 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                        Gran Final (1° y 2° Lugar)
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        1° Pool A vs Ganador Pool B
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-amber-400 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 shadow">
                    🥇 ORO Y PLATA
                  </span>
                </div>
                {doublePoolData.finalMatch && (
                  <InteractiveMatchCard
                    match={doublePoolData.finalMatch}
                    isEditMode={isEditMode}
                    selectedForSwap={selectedForSwap}
                    onSelectSlot={handleSelectSlotForSwap}
                  />
                )}
              </div>

              {/* Disputa por Bronce (3° Lugar) */}
              <div className="bg-gradient-to-b from-orange-950/20 to-slate-950/80 border border-orange-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-orange-500/30 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-[10px] shadow">
                      3°
                    </span>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                        Disputa por Bronce (3° Lugar)
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        2° Pool A vs Perdedor Pool B
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-orange-400 px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/40 shadow">
                    🥉 BRONCE
                  </span>
                </div>
                {doublePoolData.bronzeMatch && (
                  <InteractiveMatchCard
                    match={doublePoolData.bronzeMatch}
                    isEditMode={isEditMode}
                    selectedForSwap={selectedForSwap}
                    onSelectSlot={handleSelectSlotForSwap}
                  />
                )}
              </div>
            </div>
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

      {/* CASO 4: CATEGORÍA DE 1 COMPETIDOR (CAMPEÓN DIRECTO SIN CONTENDOR) */}
      {bracket_type === 'UNCONTESTED' && (
        <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-6 max-w-xl mx-auto text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono font-black text-amber-400 tracking-wider">
              1° Lugar • Medalla de Oro
            </span>
            <h4 className="text-xl font-black text-white">
              {matches[0]?.white_athlete_name || 'Competidor'}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              {matches[0]?.white_club_name || 'Club'}
            </p>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300">
            Único competidor presentado en la categoría. Campeón declarado automáticamente sin contendor.
          </div>
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
  const sanitizeAthleteName = (name: string | null | undefined): string => {
    if (!name) return 'Por definir';
    const trimmed = name.trim();
    if (trimmed === '—' || trimmed === '-') return '-';
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('lugar') ||
      lower.includes('perdedor') ||
      lower.includes('ganador') ||
      lower.includes('semifinal') ||
      lower.includes('cuartos')
    ) {
      return 'Por definir';
    }
    return trimmed;
  };

  const whiteDisplayName = sanitizeAthleteName(match.white_athlete_name);
  const blueDisplayName = sanitizeAthleteName(match.blue_athlete_name);

  const isWhiteEmpty = whiteDisplayName === '-';
  const isBlueEmpty = blueDisplayName === '-';

  const isBye =
    match.is_bye ||
    isWhiteEmpty ||
    isBlueEmpty ||
    match.white_athlete_name?.includes('Bye') ||
    match.blue_athlete_name?.includes('Bye');

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
            isBye
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : match.status === 'SCHEDULED'
              ? 'bg-blue-950 text-blue-400 border border-blue-900'
              : match.status === 'PENDING'
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : match.status === 'FINISHED'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {isBye ? 'PASE DIRECTO' : match.status === 'PENDING' ? 'EN ESPERA' : match.status}
        </span>
      </div>

      {/* Slot Blanco (White Judogi) */}
      <div
        onClick={() => {
          if (isEditMode) {
            onSelectSlot(
              match.id,
              'WHITE',
              whiteDisplayName,
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
          <span className={`w-2.5 h-2.5 rounded-full shadow flex-shrink-0 ${isWhiteEmpty ? 'bg-slate-700' : 'bg-white'}`} />
          <div className="truncate">
            <span
              className={`text-xs block truncate ${
                isWhiteEmpty
                  ? 'text-slate-500 font-normal'
                  : whiteDisplayName === 'Por definir'
                  ? 'text-slate-400 font-medium'
                  : 'font-bold text-white'
              }`}
            >
              {whiteDisplayName}
            </span>
            {match.white_club_name && whiteDisplayName !== 'Por definir' && !isWhiteEmpty && (
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
              blueDisplayName,
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
          <span className={`w-2.5 h-2.5 rounded-full shadow flex-shrink-0 ${isBlueEmpty ? 'bg-slate-700' : 'bg-blue-600'}`} />
          <div className="truncate">
            <span
              className={`text-xs block truncate ${
                isBlueEmpty
                  ? 'text-slate-500 font-normal'
                  : blueDisplayName === 'Por definir'
                  ? 'text-slate-400 font-medium'
                  : 'font-bold text-white'
              }`}
            >
              {blueDisplayName}
            </span>
            {match.blue_club_name && blueDisplayName !== 'Por definir' && !isBlueEmpty && (
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
          Pase directo
        </div>
      )}
    </div>
  );
}
