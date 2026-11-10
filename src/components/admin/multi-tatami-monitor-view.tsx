// ==============================================================================
// COMPONENTE CLIENTE: MONITOR DE COMBATES MULTI-TATAMI EN CASCADA
// ==============================================================================
//
// CARACTERÍSTICAS:
// 1. Columnas en Paralelo (Uno al lado del otro): Cada tatami tiene su columna vertical.
// 2. Conteo de Espera Dinámico: "En curso", "Siguiente (en 1 combate)", "En 2 combates", etc.
// 3. Suscripción en Tiempo Real: Supabase Realtime + polling suave de 4 segundos.
// 4. Acceso directo con 1 clic a la Mesa de Control (/tatami/[id]) y al Marcador TV.
//
// ==============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Play,
  CheckCircle2,
  Clock,
  Swords,
  ChevronRight,
  Tv,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  AlertCircle,
  ExternalLink,
  ArrowRightLeft,
  CheckSquare,
  Square,
  X,
  Loader2,
} from 'lucide-react';
import {
  getAllTatamisQueueAction,
  reassignMatchesBatchAction,
  TatamiColumn,
  MultiTatamiMatch,
} from '@/app/actions/brackets';
import { createClient } from '@/lib/supabase/client';

interface MultiTatamiMonitorViewProps {
  initialTournamentId?: string;
  initialTournamentName?: string;
}

export function MultiTatamiMonitorView({
  initialTournamentId,
  initialTournamentName,
}: MultiTatamiMonitorViewProps) {
  const router = useRouter();
  const [tournamentId, setTournamentId] = useState<string>(initialTournamentId || '');
  const [tournamentName, setTournamentName] = useState<string>(initialTournamentName || 'Campeonato Oficial');
  const [columns, setColumns] = useState<TatamiColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinished, setShowFinished] = useState<{ [tatami: number]: boolean }>({});

  // Estados para el Modal de Transferencia Masiva entre Tatamis
  const [transferModalState, setTransferModalState] = useState<{
    isOpen: boolean;
    sourceTatami: number;
    destinationTatami: number;
    selectedMatchIds: string[];
    isSubmitting: boolean;
    feedbackMessage: string | null;
  }>({
    isOpen: false,
    sourceTatami: 1,
    destinationTatami: 2,
    selectedMatchIds: [],
    isSubmitting: false,
    feedbackMessage: null,
  });

  const handleOpenTransferModal = (sourceTatami: number) => {
    const col = columns.find((c) => c.tatamiNumber === sourceTatami);
    const availableUpcoming = col?.upcomingMatches || [];
    const destinationCandidates = columns
      .map((c) => c.tatamiNumber)
      .filter((t) => t !== sourceTatami);

    const defaultDest = destinationCandidates[0] || (sourceTatami === 1 ? 2 : 1);

    setTransferModalState({
      isOpen: true,
      sourceTatami,
      destinationTatami: defaultDest,
      selectedMatchIds: availableUpcoming.map((m) => m.id),
      isSubmitting: false,
      feedbackMessage: null,
    });
  };

  const handleToggleSelectMatch = (matchId: string) => {
    setTransferModalState((prev) => {
      const isSelected = prev.selectedMatchIds.includes(matchId);
      return {
        ...prev,
        selectedMatchIds: isSelected
          ? prev.selectedMatchIds.filter((id) => id !== matchId)
          : [...prev.selectedMatchIds, matchId],
      };
    });
  };

  const handleSelectAllMatches = () => {
    const col = columns.find((c) => c.tatamiNumber === transferModalState.sourceTatami);
    const availableUpcoming = col?.upcomingMatches || [];
    setTransferModalState((prev) => ({
      ...prev,
      selectedMatchIds: availableUpcoming.map((m) => m.id),
    }));
  };

  const handleDeselectAllMatches = () => {
    setTransferModalState((prev) => ({
      ...prev,
      selectedMatchIds: [],
    }));
  };

  const handleConfirmTransfer = async () => {
    if (transferModalState.selectedMatchIds.length === 0) return;
    setTransferModalState((prev) => ({ ...prev, isSubmitting: true, feedbackMessage: null }));

    try {
      const res = await reassignMatchesBatchAction({
        matchIds: transferModalState.selectedMatchIds,
        newTatamiNumber: transferModalState.destinationTatami,
        tournamentId: tournamentId || undefined,
      });

      if (res.success) {
        setTransferModalState((prev) => ({
          ...prev,
          isSubmitting: false,
          feedbackMessage: res.message || 'Combates transferidos con éxito.',
        }));
        await loadData(false);
        setTimeout(() => {
          setTransferModalState((prev) => ({ ...prev, isOpen: false }));
        }, 1200);
      } else {
        setTransferModalState((prev) => ({
          ...prev,
          isSubmitting: false,
          feedbackMessage: res.error || 'Fallo al transferir combates.',
        }));
      }
    } catch (err: any) {
      setTransferModalState((prev) => ({
        ...prev,
        isSubmitting: false,
        feedbackMessage: err.message || 'Error de conexión.',
      }));
    }
  };

  // Cargar todos los tatamis en paralelo
  const loadData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const res = await getAllTatamisQueueAction(tournamentId || undefined);
        if (res.success) {
          setColumns(res.columns);
          if (res.tournamentId) setTournamentId(res.tournamentId);
          if (res.tournamentName) setTournamentName(res.tournamentName);
        } else {
          setColumns([]);
        }
      } catch (err: any) {
        console.error('Error cargando monitor multi-tatami:', err);
        if (!isSilent) setColumns([]);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    // 1. Carga inicial
    loadData(false);

    // 2. Suscripción a cambios en Supabase Realtime
    const supabase = createClient();
    const channel = supabase
      .channel('multi-tatami-monitor-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    // 3. Polling de respaldo cada 4 segundos
    const timer = setInterval(() => {
      loadData(true);
    }, 4000);

    return () => {
      channel.unsubscribe();
      clearInterval(timer);
    };
  }, [loadData]);

  // Manejador: Llamar a Tatami
  const handleCallMatch = (matchId: string) => {
    router.push(`/tatami/${matchId}`);
  };

  const toggleFinished = (tatamiNum: number) => {
    setShowFinished((prev) => ({
      ...prev,
      [tatamiNum]: !prev[tatamiNum],
    }));
  };

  // Totales globales
  const totalUpcoming = columns.reduce((acc, col) => acc + col.upcomingMatches.length, 0);
  const totalOngoing = columns.reduce((acc, col) => acc + (col.activeMatch ? 1 : 0), 0);
  const totalFinished = columns.reduce((acc, col) => acc + col.finishedMatches.length, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto space-y-6">
      {/* CABECERA Y METADATOS */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          {tournamentId && (
            <Link
              href={`/admin/tournaments/${tournamentId}?tab=brackets`}
              className="inline-flex items-center space-x-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Campeonato ({tournamentName})</span>
            </Link>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-7 h-7 text-amber-400" />
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                Monitor Multi-Tatami
              </h1>
            </div>

            {/* BADGE EN VIVO */}
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800 text-[11px] text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sincronización en Tiempo Real</span>
            </div>
          </div>

          <p className="text-slate-400 text-xs sm:text-sm">
            Visualización paralela de todas las áreas de combate. Muestra en cuántos combates más
            subirá cada judoka al tatami.
          </p>
        </div>

        {/* MÉTRICAS GLOBALES & BOTÓN ACTUALIZAR */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs">
            <span className="text-slate-400 font-medium">Activos:</span>
            <span className="font-black text-amber-400">{totalOngoing}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-medium">Por disputar:</span>
            <span className="font-black text-blue-400">{totalUpcoming}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-medium">Finalizados:</span>
            <span className="font-black text-emerald-400">{totalFinished}</span>
          </div>

          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center space-x-1.5"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {/* ÁREA DE COLUMNAS MULTI-TATAMI (EN CASCADA) */}
      {columns.length === 0 ? (
        <div className="p-16 text-center space-y-3 bg-slate-900/60 border border-slate-800 rounded-3xl">
          <Swords className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-lg font-bold text-white">No hay combates programados en este torneo</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Asegúrate de generar las llaves en las categorías del torneo para poblar las colas de combate.
          </p>
          {tournamentId && (
            <div className="pt-2">
              <Link
                href={`/admin/tournaments/${tournamentId}?tab=brackets`}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ir al Sorteo</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div
          className="grid gap-6 items-start"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(320px, 1fr))`,
          }}
        >
          {columns.map((col) => {
            const hasOngoing = !!col.activeMatch;

            return (
              <div
                key={col.tatamiNumber}
                className="bg-slate-900/80 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden min-w-[320px]"
              >
                {/* CABECERA DE LA COLUMNA DE TATAMI */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-500/50" />
                      <h2 className="text-lg font-black text-white tracking-wider">
                        TATAMI #{col.tatamiNumber}
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {col.upcomingMatches.length + (col.activeMatch ? 1 : 0)} combates en cola •{' '}
                      {col.finishedMatches.length} finalizados
                    </p>
                  </div>

                  {/* ACCESOS DIRECTOS DE LA COLUMNA */}
                  <div className="flex items-center space-x-1.5">
                    {/* Botón Transferir Combates Masivo */}
                    {col.upcomingMatches.length > 0 && columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleOpenTransferModal(col.tatamiNumber)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold transition flex items-center space-x-1"
                        title={`Transferir combates del Tatami ${col.tatamiNumber} a otro tatami`}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Mover</span>
                      </button>
                    )}

                    <Link
                      href={`/tatami/${col.tatamiNumber}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition flex items-center space-x-1"
                      title="Abrir Mesa de Control"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Mesa</span>
                    </Link>

                    <Link
                      href={`/scoreboard/tatami-${col.tatamiNumber}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold transition flex items-center space-x-1"
                      title="Abrir Marcador TV"
                    >
                      <Tv className="w-3 h-3" />
                      <span>TV</span>
                    </Link>
                  </div>
                </div>

                {/* CUERPO: LISTA VERTICAL DE COMBATES EN CASCADA */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {/* 1. COMBATE EN CURSO (SI EXISTE) */}
                  {col.activeMatch && (
                    <div className="bg-amber-950/40 border-2 border-amber-500/80 rounded-2xl p-3.5 space-y-2.5 shadow-xl relative overflow-hidden animate-pulse">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center space-x-1">
                          <Sparkles className="w-3 h-3" />
                          <span>EN TATAMI AHORA</span>
                        </span>
                        <span className="text-xs font-mono font-black text-amber-400">
                          Orden #{col.activeMatch.match_number}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-white block">
                          {col.activeMatch.category_name}
                        </span>
                        <span className="text-[11px] text-amber-300 font-semibold block">
                          {col.activeMatch.round_name}
                        </span>
                      </div>

                      {/* COMBATIENTES */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                          <div className="flex items-center space-x-2 truncate">
                            <span className="w-2.5 h-2.5 rounded-full bg-white flex-shrink-0" />
                            <span className="text-xs font-bold text-white truncate">
                              {col.activeMatch.white_athlete_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                            {col.activeMatch.white_club_name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-blue-950">
                          <div className="flex items-center space-x-2 truncate">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-white truncate">
                              {col.activeMatch.blue_athlete_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                            {col.activeMatch.blue_club_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. COMBATES EN COLA (CASCADA CON CONTEO DE ESPERA) */}
                  {col.upcomingMatches.length === 0 && !col.activeMatch ? (
                    <div className="py-10 text-center space-y-1.5 text-slate-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50" />
                      <p className="text-xs font-bold text-slate-400">Cola completada</p>
                      <p className="text-[11px]">No hay más combates pendientes en este tatami.</p>
                    </div>
                  ) : (
                    col.upcomingMatches.map((m) => {
                      const isNext = m.matchesUntilStart === 1;
                      const isPendingWinner = m.status === 'PENDING';

                      // Etiqueta dinámica de "en cuántos combates más se realizará"
                      let countdownBadge = '';
                      let badgeStyle = '';

                      if (isNext) {
                        countdownBadge = 'Próximo combate a entrar';
                        badgeStyle = 'bg-blue-950 text-blue-300 border-blue-800 font-black';
                      } else if (m.matchesUntilStart === 2) {
                        countdownBadge = 'En 2 combates';
                        badgeStyle = 'bg-slate-800 text-slate-200 border-slate-700 font-bold';
                      } else {
                        countdownBadge = `En ${m.matchesUntilStart} combates`;
                        badgeStyle = 'bg-slate-950 text-slate-400 border-slate-800';
                      }

                      return (
                        <div
                          key={m.id}
                          className={`border rounded-2xl p-3 space-y-2 transition ${
                            isNext
                              ? 'bg-slate-950/90 border-blue-600/60 shadow-lg'
                              : isPendingWinner
                              ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* FILA SUPERIOR: CONTEO Y ORDEN */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}
                            >
                              {countdownBadge}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                              #{m.match_number}
                            </span>
                          </div>

                          {/* METADATOS DE CATEGORÍA Y RONDA */}
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-white block truncate">
                              {m.category_name}
                            </span>
                            <span className="text-[11px] text-amber-400/90 font-medium block">
                              {m.round_name}
                            </span>
                          </div>

                          {/* JUDOKAS */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between bg-slate-900/90 px-2 py-1.5 rounded-lg border border-slate-800/80">
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
                                <span className="text-[11px] font-bold text-white truncate">
                                  {m.white_athlete_name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                                {m.white_club_name}
                              </span>
                            </div>

                            <div className="flex items-center justify-between bg-slate-900/90 px-2 py-1.5 rounded-lg border border-blue-950/80">
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-white truncate">
                                  {m.blue_athlete_name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                                {m.blue_club_name}
                              </span>
                            </div>
                          </div>

                          {/* BOTÓN LLAMAR A MESA */}
                          {!isPendingWinner && (
                            <button
                              type="button"
                              onClick={() => handleCallMatch(m.id)}
                              className="w-full py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition flex items-center justify-center space-x-1"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Llamar a Tatami</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* 3. COMBATES FINALIZADOS (ACORDEÓN COLAPSABLE) */}
                  {col.finishedMatches.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => toggleFinished(col.tatamiNumber)}
                        className="w-full text-left text-[11px] font-bold text-slate-400 hover:text-white flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 transition"
                      >
                        <span className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {col.finishedMatches.length} combates finalizados
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {showFinished[col.tatamiNumber] ? 'Ocultar' : 'Ver'}
                        </span>
                      </button>

                      {showFinished[col.tatamiNumber] && (
                        <div className="space-y-1.5 pt-2">
                          {col.finishedMatches.map((fm) => (
                            <div
                              key={fm.id}
                              className="p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between"
                            >
                              <span className="font-mono font-bold text-emerald-400">
                                #{fm.match_number}
                              </span>
                              <span className="truncate max-w-[130px] font-medium text-slate-300">
                                {fm.white_athlete_name} vs {fm.blue_athlete_name}
                              </span>
                              <span className="text-emerald-500 font-bold uppercase text-[9px]">
                                FINISHED
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE TRANSFERENCIA MASIVA DE COMBATES ENTRE TATAMIS */}
      {transferModalState.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Transferir Combates desde Tatami #{transferModalState.sourceTatami}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Reasigna combates pendientes para acelerar el campeonato cuando un tatami termina antes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalState((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Tatami Destino */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                Selecciona el Tatami Destino:
              </label>
              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((c) => c.tatamiNumber !== transferModalState.sourceTatami)
                  .map((c) => {
                    const isSelected = transferModalState.destinationTatami === c.tatamiNumber;
                    return (
                      <button
                        key={c.tatamiNumber}
                        type="button"
                        onClick={() =>
                          setTransferModalState((prev) => ({
                            ...prev,
                            destinationTatami: c.tatamiNumber,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center space-x-2 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Tatami #{c.tatamiNumber}</span>
                        <span className="text-[10px] opacity-80">
                          ({c.upcomingMatches.length + (c.activeMatch ? 1 : 0)} combates)
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Accesos rápidos de selección */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 pt-1 text-xs">
              <span className="font-bold text-slate-300">
                Combates seleccionados: {transferModalState.selectedMatchIds.length}
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleSelectAllMatches}
                  className="text-amber-400 hover:text-amber-300 font-bold transition flex items-center space-x-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Todos</span>
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAllMatches}
                  className="text-slate-400 hover:text-slate-300 font-bold transition flex items-center space-x-1"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Ninguno</span>
                </button>
              </div>
            </div>

            {/* Lista Scrollable de Combates Pendientes */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[40vh]">
              {(() => {
                const col = columns.find((c) => c.tatamiNumber === transferModalState.sourceTatami);
                const matches = col?.upcomingMatches || [];

                if (matches.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      No hay combates pendientes disponibles en este tatami.
                    </div>
                  );
                }

                return matches.map((m) => {
                  const isChecked = transferModalState.selectedMatchIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleSelectMatch(m.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-amber-950/20 border-amber-500/50 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition flex-shrink-0 ${
                            isChecked
                              ? 'bg-amber-500 border-amber-400 text-slate-950'
                              : 'bg-slate-900 border-slate-700'
                          }`}
                        >
                          {isChecked && <CheckSquare className="w-3.5 h-3.5" />}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-amber-400">
                              #{m.match_number}
                            </span>
                            <span className="text-xs font-bold text-slate-200 truncate">
                              {m.category_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({m.round_name})
                            </span>
                          </div>
                          <div className="text-xs truncate text-slate-300 mt-0.5">
                            <span className="font-medium">{m.white_athlete_name}</span>
                            <span className="text-slate-500 mx-1.5">vs</span>
                            <span className="font-medium">{m.blue_athlete_name}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          m.status === 'SCHEDULED'
                            ? 'bg-blue-950/60 text-blue-400 border-blue-800'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Feedback Message */}
            {transferModalState.feedbackMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  transferModalState.feedbackMessage.includes('éxito')
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/60 border border-red-500/50 text-red-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{transferModalState.feedbackMessage}</span>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center space-x-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTransferModalState((prev) => ({ ...prev, isOpen: false }))}
                disabled={transferModalState.isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={
                  transferModalState.isSubmitting ||
                  transferModalState.selectedMatchIds.length === 0
                }
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-1.5 ${
                  transferModalState.selectedMatchIds.length > 0 &&
                  !transferModalState.isSubmitting
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {transferModalState.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transfiriendo...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>
                      Transferir {transferModalState.selectedMatchIds.length} a Tatami #
                      {transferModalState.destinationTatami}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
