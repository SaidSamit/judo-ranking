// ==============================================================================
// COMPONENTE PÚBLICO: MONITOR MULTI-TATAMI EN VIVO (BROADCAST & SMARTPHONE)
// ==============================================================================
//
// CARACTERÍSTICAS Y ESTÁNDARES IJF / SMOOTHCOMP:
// 1. 100% Público: Sin requerir login, sin contraseñas, sin controles de director.
// 2. Jerarquía Oficial de Llamado (Calling System):
//    - EN TATAMI AHORA (En disputa activa - Borde esmeralda)
//    - A CONTINUACIÓN (Siguiente a entrar - Zona de llamada con judogi puesto)
//    - EN 2 COMBATES (Zona de calentamiento activo)
//    - EN N COMBATES (En programación)
// 3. Franjas oficiales de Judogi Blanco y Azul de alta visibilidad.
// 4. Modo "Tus Combates": Al buscar un atleta, despliega su itinerario cronológico
//    completo con Tatami, turno y color de Judogi sin necesidad de buscar tatami por tatami.
// 5. Cabecera móvil compacta de alta densidad.
// 6. Modo Broadcast Smart TV (>= 1024px) con pantalla completa.
//
// ==============================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Search,
  Maximize2,
  Minimize2,
  Clock,
  Swords,
  X,
  Tv,
  UserCheck,
} from 'lucide-react';
import {
  getAllTatamisQueueAction,
  TatamiColumn,
  MultiTatamiMatch,
} from '@/app/actions/brackets';
import { createClient } from '@/lib/supabase/client';
import { TatamiColumnCard } from '@/components/tatami/tatami-column-card';

interface PublicMultiTatamiMonitorProps {
  tournamentId: string;
  initialTournamentName: string;
  initialColumns: TatamiColumn[];
}

interface AgendaItem {
  match: MultiTatamiMatch;
  tatamiNumber: number;
  userSlot: 'WHITE' | 'BLUE' | 'BOTH' | 'NONE';
  isLiveNow: boolean;
}

export function PublicMultiTatamiMonitor({
  tournamentId,
  initialTournamentName,
  initialColumns,
}: PublicMultiTatamiMonitorProps) {
  const [tournamentName, setTournamentName] = useState(initialTournamentName);
  const [columns, setColumns] = useState<TatamiColumn[]>(initialColumns);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMobileView, setSelectedMobileView] = useState<number | 'ALL' | 'MY_MATCHES'>('ALL');
  const [showFinished, setShowFinished] = useState<Record<number, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // 1. Reloj digital en vivo
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Control de Pantalla Completa nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Error conmutando pantalla completa:', err);
    }
  };

  // 3. Cargar datos desde el servidor
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        const res = await getAllTatamisQueueAction(tournamentId);
        if (res.success) {
          setColumns(res.columns);
          if (res.tournamentName) setTournamentName(res.tournamentName);
        }
      } catch (err) {
        console.error('[PublicMultiTatamiMonitor] Error recargando:', err);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [tournamentId]
  );

  // 4. Suscripción en Tiempo Real con Supabase + Polling de respaldo (4s)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`public-multi-tatami-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: tournamentId ? `tournament_id=eq.${tournamentId}` : undefined,
        },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    const timer = setInterval(() => {
      loadData(true);
    }, 4000);

    return () => {
      channel.unsubscribe();
      clearInterval(timer);
    };
  }, [tournamentId, loadData]);

  // 5. Función de búsqueda / coincidencia
  const matchMatchesSearch = useCallback(
    (m: MultiTatamiMatch): boolean => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return false;
      return (
        m.white_athlete_name.toLowerCase().includes(q) ||
        m.blue_athlete_name.toLowerCase().includes(q) ||
        m.white_club_name.toLowerCase().includes(q) ||
        m.blue_club_name.toLowerCase().includes(q) ||
        m.category_name.toLowerCase().includes(q) ||
        String(m.match_number) === q
      );
    },
    [searchQuery]
  );

  // Identificar qué lado (Blanco o Azul) corresponde a la búsqueda
  const getUserSlot = useCallback(
    (m: MultiTatamiMatch): 'WHITE' | 'BLUE' | 'BOTH' | 'NONE' => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return 'NONE';

      const whiteMatches =
        m.white_athlete_name.toLowerCase().includes(q) ||
        m.white_club_name.toLowerCase().includes(q);
      const blueMatches =
        m.blue_athlete_name.toLowerCase().includes(q) ||
        m.blue_club_name.toLowerCase().includes(q);

      if (whiteMatches && blueMatches) return 'BOTH';
      if (whiteMatches) return 'WHITE';
      if (blueMatches) return 'BLUE';
      return 'NONE';
    },
    [searchQuery]
  );

  // 6. Agenda Unificada de Combates del Atleta Buscado ("Tus Combates")
  const userAgendaMatches = useMemo<AgendaItem[]>(() => {
    if (!searchQuery.trim()) return [];

    const items: AgendaItem[] = [];

    columns.forEach((col) => {
      // Si está en curso en este tatami
      if (col.activeMatch && matchMatchesSearch(col.activeMatch)) {
        items.push({
          match: col.activeMatch,
          tatamiNumber: col.tatamiNumber,
          userSlot: getUserSlot(col.activeMatch),
          isLiveNow: true,
        });
      }

      // Si está en espera
      col.upcomingMatches.forEach((m) => {
        if (matchMatchesSearch(m)) {
          items.push({
            match: m,
            tatamiNumber: col.tatamiNumber,
            userSlot: getUserSlot(m),
            isLiveNow: false,
          });
        }
      });
    });

    // Ordenar cronológicamente: primero los que están en tatami ahora, luego por turnos de espera
    return items.sort((a, b) => {
      if (a.isLiveNow && !b.isLiveNow) return -1;
      if (!a.isLiveNow && b.isLiveNow) return 1;
      return a.match.matchesUntilStart - b.match.matchesUntilStart;
    });
  }, [columns, searchQuery, matchMatchesSearch, getUserSlot]);

  // Si el usuario escribe y encuentra combates, cambiar automáticamente a vista de sus combates
  useEffect(() => {
    if (searchQuery.trim() && userAgendaMatches.length > 0) {
      setSelectedMobileView('MY_MATCHES');
    } else if (!searchQuery.trim()) {
      setSelectedMobileView('ALL');
    }
  }, [searchQuery, userAgendaMatches.length]);

  // Métricas globales
  const totalUpcoming = useMemo(
    () => columns.reduce((acc, col) => acc + col.upcomingMatches.length, 0),
    [columns]
  );
  const totalOngoing = useMemo(
    () => columns.reduce((acc, col) => acc + (col.activeMatch ? 1 : 0), 0),
    [columns]
  );
  const totalFinished = useMemo(
    () => columns.reduce((acc, col) => acc + col.finishedMatches.length, 0),
    [columns]
  );

  const toggleShowFinished = (tatamiNum: number) => {
    setShowFinished((prev) => ({
      ...prev,
      [tatamiNum]: !prev[tatamiNum],
    }));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* ============================================================== */}
      {/* CABECERA PÚBLICA ULTRA-COMPACTA DE ALTA DENSIDAD               */}
      {/* ============================================================== */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-3.5 sm:px-6 py-2 shadow-xl backdrop-blur-md bg-slate-900/95">
        <div className="max-w-[1920px] mx-auto flex flex-col gap-2">
          {/* FILA 1: TÍTULO, EN VIVO, RELOJ Y BOTONES */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1 flex items-center space-x-2">
                <h1 className="text-sm sm:text-lg font-black text-white tracking-tight truncate">
                  {tournamentName}
                </h1>
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700 text-[10px] text-emerald-400 font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>EN VIVO</span>
                </div>
              </div>
            </div>

            {/* CONTROLES: RELOJ + FULLSCREEN + REFRESH */}
            <div className="flex items-center space-x-1.5 shrink-0">
              {currentTime && (
                <div className="hidden sm:flex items-center space-x-1 font-mono text-xs text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>{currentTime}</span>
                </div>
              )}

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1 active:scale-95"
                title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa (TV)'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">Restaurar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden md:inline">Pantalla Completa</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => loadData(false)}
                disabled={loading}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center active:scale-95"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* FILA 2: BUSCADOR & MÉTRICAS GLOBALES */}
          <div className="flex items-center justify-between gap-2.5">
            {/* BUSCADOR */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por judoka, club o categoría..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 font-medium focus:outline-none focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* MÉTRICAS COMPACTAS */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] shrink-0 font-mono">
              <span className="text-slate-400">En Tatami: <strong className="text-amber-400">{totalOngoing}</strong></span>
              <span className="text-slate-700">•</span>
              <span className="text-slate-400">En Cola: <strong className="text-blue-400">{totalUpcoming}</strong></span>
            </div>
          </div>

          {/* FILA 3: SELECTOR DE PESTAÑAS EN MÓVIL (< 1024px) */}
          <div className="flex lg:hidden items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {/* PESTAÑA AUTOMÁTICA "TUS COMBATES" (SI HAY BÚSQUEDA) */}
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSelectedMobileView('MY_MATCHES')}
                className={`px-3 py-1 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center space-x-1.5 ${
                  selectedMobileView === 'MY_MATCHES'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Tus Combates ({userAgendaMatches.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedMobileView('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedMobileView === 'ALL'
                  ? 'bg-slate-200 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos los Tatamis ({totalOngoing + totalUpcoming})
            </button>

            {columns.map((col) => {
              const count = col.upcomingMatches.length + (col.activeMatch ? 1 : 0);
              const userMatchesInThisTatami = userAgendaMatches.filter(
                (a) => a.tatamiNumber === col.tatamiNumber
              ).length;

              return (
                <button
                  key={col.tatamiNumber}
                  type="button"
                  onClick={() => setSelectedMobileView(col.tatamiNumber)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1 ${
                    selectedMobileView === col.tatamiNumber
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>Tatami #{col.tatamiNumber}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                  {userMatchesInThisTatami > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950">
                      {userMatchesInThisTatami}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* CONTENIDO PRINCIPAL: MULTI-TATAMI GRID                         */}
      {/* ============================================================== */}
      <div className="flex-1 max-w-[1920px] w-full mx-auto p-3.5 sm:p-6 lg:p-8 space-y-6">
        {columns.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl">
            <Swords className="w-12 h-12 mx-auto text-slate-600" />
            <h2 className="text-lg font-bold text-white">No hay combates programados en este momento</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Las llaves de combate se están sorteando en la mesa de control. Una vez que se asignen los tatamis, aparecerán aquí automáticamente en tiempo real.
            </p>
          </div>
        ) : (
          <>
            {/* ========================================================== */}
            {/* VISTA MÓVIL: MODO "TUS COMBATES" (AGENDA PERSONAL)         */}
            {/* ========================================================== */}
            {selectedMobileView === 'MY_MATCHES' && searchQuery.trim() ? (
              <div className="block lg:hidden space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <span>Itinerario de Combates para &quot;{searchQuery}&quot;</span>
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {userAgendaMatches.length} combate{userAgendaMatches.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Orden cronológico según llamado en mesa. Verifica tu Tatami y color de Judogi.
                  </p>
                </div>

                {userAgendaMatches.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-xs">
                    No se encontraron combates activos o en cola para &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userAgendaMatches.map((item) => (
                      <AgendaMatchCard key={item.match.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ======================================================== */
              /* VISTA MÓVIL HABITUAL: TATAMI SELECCIONADO O TODOS        */
              /* ======================================================== */
              <div className="block lg:hidden space-y-6">
                {columns
                  .filter(
                    (col) =>
                      selectedMobileView === 'ALL' ||
                      col.tatamiNumber === selectedMobileView
                  )
                  .map((col) => (
                    <TatamiColumnCard
                      key={col.tatamiNumber}
                      column={col}
                      isMatchHighlighted={matchMatchesSearch}
                      getUserSlot={getUserSlot}
                      showFinished={!!showFinished[col.tatamiNumber]}
                      onToggleFinished={() => toggleShowFinished(col.tatamiNumber)}
                    />
                  ))}
              </div>
            )}

            {/* ========================================================== */}
            {/* VISTA BROADCAST SMART TV / DESKTOP (PANTALLAS >= 1024px)   */}
            {/* ========================================================== */}
            <div
              className="hidden lg:grid gap-6 items-start"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(320px, 1fr))`,
              }}
            >
              {columns.map((col) => (
                <TatamiColumnCard
                  key={col.tatamiNumber}
                  column={col}
                  isMatchHighlighted={matchMatchesSearch}
                  getUserSlot={getUserSlot}
                  showFinished={!!showFinished[col.tatamiNumber]}
                  onToggleFinished={() => toggleShowFinished(col.tatamiNumber)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ==============================================================================
// SUB-COMPONENTE: TARJETA DE AGENDA PERSONAL DEL ATLETA ("TUS COMBATES")
// ==============================================================================

function AgendaMatchCard({ item }: { item: AgendaItem }) {
  const { match: m, tatamiNumber, userSlot, isLiveNow } = item;

  let callingLabel = '';
  let callingStyle = '';

  if (isLiveNow) {
    callingLabel = 'EN TATAMI AHORA';
    callingStyle = 'bg-amber-500 text-slate-950 font-black animate-pulse flex items-center space-x-1';
  } else if (m.matchesUntilStart === 1) {
    callingLabel = 'A CONTINUACIÓN';
    callingStyle = 'bg-blue-950 text-blue-300 border border-blue-700 font-black animate-pulse';
  } else if (m.matchesUntilStart === 2) {
    callingLabel = 'EN 2 COMBATES';
    callingStyle = 'bg-slate-800 text-slate-200 border border-slate-700 font-bold';
  } else {
    callingLabel = `EN ${m.matchesUntilStart} COMBATES`;
    callingStyle = 'bg-slate-950 text-slate-400 font-medium border border-slate-800';
  }

  return (
    <div
      className={`border rounded-2xl p-3.5 space-y-2.5 shadow-xl transition ${
        isLiveNow
          ? 'border-2 border-amber-500/80 bg-amber-950/25 ring-1 ring-amber-500/30'
          : m.matchesUntilStart === 1
          ? 'border-blue-600/70 bg-slate-950/90 shadow-md'
          : 'border-slate-800 bg-slate-900/90'
      }`}
    >
      {/* ENCABEZADO DE AGENDA: TATAMI + ESTADO OFICIAL */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500 text-slate-950 font-mono shadow-sm">
            TATAMI #{tatamiNumber}
          </span>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${callingStyle}`}>
            {isLiveNow && <Sparkles className="w-3 h-3 fill-current inline-block mr-1" />}
            <span>{callingLabel}</span>
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-slate-400">
          Combate #{m.match_number}
        </span>
      </div>

      {/* CATEGORÍA Y RONDA */}
      <div className="space-y-0.5">
        <span className="text-xs font-black text-white block leading-tight">
          {m.category_name}
        </span>
        <span className="text-[11px] text-amber-300 font-semibold block">
          {m.round_name}
        </span>
      </div>

      {/* BLOQUES OFICIALES DE JUDOGI: BLANCO Y AZUL */}
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
            <span className="text-xs font-bold text-white truncate">
              {m.white_athlete_name}
            </span>
            {(userSlot === 'WHITE' || userSlot === 'BOTH') && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                TÚ
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
            {m.white_club_name}
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
            <span className="text-xs font-bold text-white truncate">
              {m.blue_athlete_name}
            </span>
            {(userSlot === 'BLUE' || userSlot === 'BOTH') && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950 shrink-0">
                TÚ
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
            {m.blue_club_name}
          </span>
        </div>
      </div>
    </div>
  );
}
