// ==============================================================================
// COMPONENTE: MESA DE CONTROL DEL TATAMI (PWA OFFLINE-FIRST CON EVENT SOURCING)
// ==============================================================================
//
// ¿POR QUÉ ESTA ARQUITECTURA?
// 1. Unidirectional Data Flow: El estado visual de los puntos NUNCA se edita
//    manualmente en variables separadas. Toda la pantalla se deriva proyectando
//    el arreglo inmutable de eventos (Event Sourcing).
// 2. Tolerancia a Fallos de Red: Cada golpe de tecla se persiste primero en
//    IndexedDB de forma atómica. Si se apaga la laptop o se cae el router del
//    gimnasio, al recargar la página la pila de eventos está intacta.
// 3. Undo Quirúrgico (Shift + Key): Al presionar Shift + Q, el hook encuentra
//    exactamente el último Ippon del blanco y lo desactiva, preservando el resto
//    de las acciones del combate.
//
// ==============================================================================

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MatchEvent, CombatantColor, MatchAction } from '@/types/events';
import { projectMatchState, getOsaekomiAward } from '@/lib/rules/ijf-engine';
import { useTatamiShortcuts } from '@/hooks/use-tatami-shortcuts';
import {
  appendLocalEvent,
  getMatchEventsLocally,
  markEventUndoneLocally,
  saveMatchLocally,
  LocalMatch,
} from '@/lib/offline/db';

interface TatamiControlTableProps {
  initialMatch: LocalMatch;
}

export function TatamiControlTable({ initialMatch }: TatamiControlTableProps) {
  // 1. Estado de la Pila de Eventos (Fuente Única de Verdad)
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [matchTimeRemaining, setMatchTimeRemaining] = useState<number>(
    initialMatch.match_duration_seconds
  );
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
  const [activeOsaekomi, setActiveOsaekomi] = useState<CombatantColor | null>(null);
  const [osaekomiSeconds, setOsaekomiSeconds] = useState<number>(0);
  const [isGoldenScore, setIsGoldenScore] = useState<boolean>(false);
  const [matchStatus, setMatchStatus] = useState<LocalMatch['status']>(initialMatch.status);

  // Modal de Hansoku-make diferido (tipificación técnica vs disciplinaria al cerrar con Enter)
  const [showHansokuModal, setShowHansokuModal] = useState<boolean>(false);
  const [selectedHansokuType, setSelectedHansokuType] = useState<'TECHNICAL' | 'DISCIPLINARY'>('TECHNICAL');

  // Ref para controlar el bucle de temporizadores de alta precisión
  const masterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentOsaekomiSessionIdRef = useRef<string | null>(null);
  const osaekomiAwardedRef = useRef<{ yuko: boolean; wazaari: boolean; ippon: boolean }>({
    yuko: false,
    wazaari: false,
    ippon: false,
  });

  // ============================================================================
  // CARGA INICIAL DESDE INDEXEDDB (OFFLINE-FIRST)
  // ============================================================================
  useEffect(() => {
    async function loadOfflineData() {
      try {
        await saveMatchLocally(initialMatch);
        const storedEvents = await getMatchEventsLocally(initialMatch.id);
        if (storedEvents.length > 0) {
          setEvents(storedEvents);
        }
      } catch (err) {
        console.error('Error cargando IndexedDB:', err);
      }
    }
    loadOfflineData();
  }, [initialMatch]);

  // ============================================================================
  // PROYECCIÓN MATEMÁTICA DEL MARCADOR (EVENT SOURCING)
  // ============================================================================
  const projection = useMemo(() => {
    return projectMatchState(events);
  }, [events]);

  // Estado y ref para alertas y candados de validación en tiempo real
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerWarning = useCallback((message: string) => {
    setValidationWarning(message);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setValidationWarning(null);
    }, 3500);
  }, []);

  // Formato mm:ss para el reloj principal
  const formatTime = useCallback((totalSeconds: number) => {
    const mins = Math.floor(Math.abs(totalSeconds) / 60);
    const secs = Math.abs(totalSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // ============================================================================
  // DESPACHO ATÓMICO DE EVENTOS CON CANDADOS DE SEGURIDAD (GATEKEEPER)
  // ============================================================================
  const dispatchEvent = useCallback(
    async (action: MatchAction, target: CombatantColor | null, payload = {}) => {
      // CORRECCIÓN 2: Candado de Shidos (Máximo 3) y Candado post-descalificación
      if (action === 'ADD_SHIDO' && target) {
        const targetScore = target === 'WHITE' ? projection.white_score : projection.blue_score;
        if (targetScore.shido >= 3 || targetScore.has_hansoku_make) {
          triggerWarning(
            `Acción bloqueada: ${target === 'WHITE' ? 'Blanco' : 'Azul'} ya acumula 3 Shidos (Hansoku-Make).`
          );
          return;
        }
      }

      const nextSeq = events.length + 1;
      const newEvent: MatchEvent = {
        id: crypto.randomUUID(),
        match_id: initialMatch.id,
        sequence_number: nextSeq,
        action,
        target,
        match_time: formatTime(matchTimeRemaining),
        match_time_seconds: initialMatch.match_duration_seconds - matchTimeRemaining,
        is_undone: false,
        payload,
        created_at: new Date().toISOString(),
        synced_to_cloud: false,
      };

      // 1. Actualizar memoria de React
      setEvents((prev) => [...prev, newEvent]);

      // 2. Guardar en IndexedDB local de inmediato
      try {
        await appendLocalEvent(newEvent);
      } catch (err) {
        console.error('Error persistiendo evento en IndexedDB:', err);
      }
    },
    [
      events.length,
      formatTime,
      initialMatch.id,
      initialMatch.match_duration_seconds,
      matchTimeRemaining,
      projection.blue_score,
      projection.white_score,
      triggerWarning,
    ]
  );

  // ============================================================================
  // REGLA CRÍTICA: UNDO SELECTIVO POR TECLA (SHIFT + KEY)
  // ============================================================================
  const handleUndoSpecificAction = useCallback(
    async (action: MatchAction, target: CombatantColor) => {
      // Buscar de atrás hacia adelante el último evento activo de esa acción y atleta
      let targetEventIndex = -1;
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (!ev.is_undone && ev.action === action && ev.target === target) {
          targetEventIndex = i;
          break;
        }
      }

      if (targetEventIndex === -1) {
        return;
      }

      const eventToUndo = events[targetEventIndex];
      const undoMarkerId = crypto.randomUUID();

      // 1. Actualizar estado local en memoria marcando is_undone = true
      setEvents((prev) =>
        prev.map((ev, idx) =>
          idx === targetEventIndex
            ? { ...ev, is_undone: true, undone_by_event_id: undoMarkerId }
            : ev
        )
      );

      // 2. Persistir reversión en IndexedDB
      try {
        await markEventUndoneLocally(eventToUndo.id, undoMarkerId);
      } catch (err) {
        console.error('Error al aplicar undo en IndexedDB:', err);
      }
    },
    [events]
  );

  // ============================================================================
  // CONTROL DEL RELOJ PRINCIPAL (HAJIME / MATE)
  // ============================================================================
  const toggleClock = useCallback(() => {
    setIsClockRunning((prev) => {
      const next = !prev;
      dispatchEvent(next ? 'START_CLOCK' : 'STOP_CLOCK', null);
      if (next && matchStatus === 'SCHEDULED') {
        setMatchStatus('ONGOING');
      } else if (!next && matchStatus === 'ONGOING') {
        setMatchStatus('PAUSED');
      }
      return next;
    });
  }, [dispatchEvent, matchStatus]);

  // ============================================================================
  // CONTROL DE RETENCIÓN: OSAEKOMI SWAP Y GESTIÓN DE SESIÓN
  // ============================================================================
  const swapOsaekomi = useCallback(async () => {
    if (!activeOsaekomi) return;
    const oldColor = activeOsaekomi;
    const newColor: CombatantColor = oldColor === 'WHITE' ? 'BLUE' : 'WHITE';
    const currentSessionId = currentOsaekomiSessionIdRef.current;

    // 1. Identificar eventos automáticos otorgados durante la retención actual al atleta equivocado
    const eventsToSwap = events.filter(
      (ev) =>
        !ev.is_undone &&
        ev.payload?.source === 'OSAEKOMI' &&
        ev.payload?.session_id === currentSessionId &&
        ev.target === oldColor
    );

    let updatedEvents = [...events];
    let nextSeq = updatedEvents.length + 1;
    const newTransferredEvents: MatchEvent[] = [];

    // 2. Anular inmutablemente los puntos del atleta original (is_undone: true)
    for (const oldEv of eventsToSwap) {
      const undoMarkerId = crypto.randomUUID();
      updatedEvents = updatedEvents.map((ev) =>
        ev.id === oldEv.id ? { ...ev, is_undone: true, undone_by_event_id: undoMarkerId } : ev
      );

      try {
        await markEventUndoneLocally(oldEv.id, undoMarkerId);
      } catch (err) {
        console.error('Error anulando evento en swap de Osaekomi:', err);
      }

      // 3. Generar evento de puntaje gemelo para el nuevo atleta correcto
      const transferredEvent: MatchEvent = {
        id: crypto.randomUUID(),
        match_id: initialMatch.id,
        sequence_number: nextSeq++,
        action: oldEv.action,
        target: newColor,
        match_time: formatTime(matchTimeRemaining),
        match_time_seconds: initialMatch.match_duration_seconds - matchTimeRemaining,
        is_undone: false,
        payload: {
          source: 'OSAEKOMI',
          session_id: currentSessionId,
          transferred_from_event_id: oldEv.id,
        },
        created_at: new Date().toISOString(),
        synced_to_cloud: false,
      };
      newTransferredEvents.push(transferredEvent);

      try {
        await appendLocalEvent(transferredEvent);
      } catch (err) {
        console.error('Error persistiendo evento transferido en swap:', err);
      }
    }

    // 4. Registrar evento formal SWAP_OSAEKOMI en el stream
    const swapEvent: MatchEvent = {
      id: crypto.randomUUID(),
      match_id: initialMatch.id,
      sequence_number: nextSeq++,
      action: 'SWAP_OSAEKOMI',
      target: newColor,
      match_time: formatTime(matchTimeRemaining),
      match_time_seconds: initialMatch.match_duration_seconds - matchTimeRemaining,
      is_undone: false,
      payload: {
        from: oldColor,
        to: newColor,
        transferred_points_count: eventsToSwap.length,
        session_id: currentSessionId,
      },
      created_at: new Date().toISOString(),
      synced_to_cloud: false,
    };

    try {
      await appendLocalEvent(swapEvent);
    } catch (err) {
      console.error('Error persistiendo SWAP_OSAEKOMI:', err);
    }

    // 5. Aplicar cambios atómicamente al estado de React
    setEvents([...updatedEvents, ...newTransferredEvents, swapEvent]);
    setActiveOsaekomi(newColor);
  }, [
    activeOsaekomi,
    events,
    formatTime,
    initialMatch.id,
    initialMatch.match_duration_seconds,
    matchTimeRemaining,
  ]);

  // ============================================================================
  // CORRECCIÓN 1: INICIO DE RETENCIÓN CON SWAP IMPLÍCITO (TECLAS A Y L)
  // ============================================================================
  const startOsaekomi = useCallback(
    (target: CombatantColor) => {
      // Si ya está reteniendo el MISMO atleta, ignorar para evitar reinicio accidental
      if (activeOsaekomi === target) return;

      // CORRECCIÓN 1: Si ya hay un Osaekomi activo del RIVAL (ej. L cuando Blanco tenía A),
      // interceptar e invocar swapOsaekomi() para transferir retención sin reiniciar a 0.
      if (activeOsaekomi && activeOsaekomi !== target) {
        swapOsaekomi();
        return;
      }

      // Inicio normal de Osaekomi cuando no había retención activa
      const sessionId = crypto.randomUUID();
      currentOsaekomiSessionIdRef.current = sessionId;
      setActiveOsaekomi(target);
      setOsaekomiSeconds(0);
      osaekomiAwardedRef.current = { yuko: false, wazaari: false, ippon: false };
      dispatchEvent('START_OSAEKOMI', target, { session_id: sessionId });

      // Si el reloj principal no estaba corriendo, arrancar combate
      if (!isClockRunning) {
        setIsClockRunning(true);
        dispatchEvent('START_CLOCK', null);
      }
    },
    [activeOsaekomi, dispatchEvent, isClockRunning, swapOsaekomi]
  );

  const stopOsaekomi = useCallback(() => {
    if (!activeOsaekomi) return;
    const sessionId = currentOsaekomiSessionIdRef.current;
    currentOsaekomiSessionIdRef.current = null;
    setActiveOsaekomi(null);
    setOsaekomiSeconds(0);
    osaekomiAwardedRef.current = { yuko: false, wazaari: false, ippon: false };
    dispatchEvent('STOP_OSAEKOMI', null, { session_id: sessionId });
  }, [activeOsaekomi, dispatchEvent]);

  // ============================================================================
  // HELPER: ESCALADO ABSORBENTE DEL OSAEKOMI (IJF RULE)
  // Anula el puntaje inferior previo de ESTA retención antes de otorgar el superior.
  // 5s Yuko -> (10s Waza-ari absorbe Yuko) -> (20s Ippon absorbe Waza-ari)
  // ============================================================================
  const undoOsaekomiScore = useCallback((actionToUndo: MatchAction) => {
    const currentSessionId = currentOsaekomiSessionIdRef.current;
    if (!currentSessionId) return;
    const undoMarkerId = crypto.randomUUID();
    let undoneEventId: string | null = null;

    setEvents((prevEvents) => {
      return prevEvents.map((ev) => {
        if (
          !ev.is_undone &&
          ev.payload?.source === 'OSAEKOMI' &&
          ev.payload?.session_id === currentSessionId &&
          ev.action === actionToUndo
        ) {
          undoneEventId = ev.id;
          return { ...ev, is_undone: true, undone_by_event_id: undoMarkerId };
        }
        return ev;
      });
    });

    if (undoneEventId) {
      markEventUndoneLocally(undoneEventId, undoMarkerId).catch((err) =>
        console.error('Error persistiendo anulación de puntaje absorbido en IndexedDB:', err)
      );
    }
  }, []);

  // ============================================================================
  // TEMPORIZADOR MAESTRO Y CÁLCULO DINÁMICO DE OSAEKOMI (IJF)
  // ============================================================================
  useEffect(() => {
    if (isClockRunning) {
      masterTimerRef.current = setInterval(() => {
        // 1. Decrementar reloj principal
        setMatchTimeRemaining((prevTime) => {
          if (prevTime > 0) {
            return prevTime - 1;
          }
          // Si llegó a 0:00 pero hay Osaekomi activo, el combate sigue hasta Toketa o Ippon
          return 0;
        });

        // 2. Incrementar Osaekomi si hay retención activa
        if (activeOsaekomi) {
          setOsaekomiSeconds((prevOsae) => {
            const nextOsae = prevOsae + 1;
            const award = getOsaekomiAward(nextOsae, isGoldenScore);

            // Regla 5 a 9s: Yuko automático
            if (award === 'YUKO' && !osaekomiAwardedRef.current.yuko) {
              osaekomiAwardedRef.current.yuko = true;
              dispatchEvent('ADD_YUKO', activeOsaekomi, {
                source: 'OSAEKOMI',
                session_id: currentOsaekomiSessionIdRef.current,
              });
              if (isGoldenScore) {
                setIsClockRunning(false);
                return nextOsae;
              }
            }

            // CORRECCIÓN 1: Regla 10 a 19s (Escalado Absorbente)
            // Waza-ari absorbe y anula el Yuko inyectado a los 5s de esta misma retención
            if (award === 'WAZA_ARI' && !osaekomiAwardedRef.current.wazaari) {
              osaekomiAwardedRef.current.wazaari = true;
              undoOsaekomiScore('ADD_YUKO');
              dispatchEvent('ADD_WAZA_ARI', activeOsaekomi, {
                source: 'OSAEKOMI',
                session_id: currentOsaekomiSessionIdRef.current,
              });
            }

            // CORRECCIÓN 1: Regla 20s (Escalado Absorbente y Detención)
            // Ippon absorbe y anula el Waza-ari inyectado a los 10s de esta misma retención
            if (award === 'IPPON' && !osaekomiAwardedRef.current.ippon) {
              osaekomiAwardedRef.current.ippon = true;
              undoOsaekomiScore('ADD_WAZA_ARI');
              dispatchEvent('ADD_IPPON', activeOsaekomi, {
                source: 'OSAEKOMI',
                session_id: currentOsaekomiSessionIdRef.current,
              });
              setIsClockRunning(false);
              setActiveOsaekomi(null);
            }

            return nextOsae;
          });
        }
      }, 1000);
    } else {
      if (masterTimerRef.current) clearInterval(masterTimerRef.current);
    }

    return () => {
      if (masterTimerRef.current) clearInterval(masterTimerRef.current);
    };
  }, [isClockRunning, activeOsaekomi, isGoldenScore, dispatchEvent, undoOsaekomiScore]);

  // ============================================================================
  // CORRECCIÓN 2: DETENCIÓN AUTOMÁTICA POR IPPON O HANSOKU-MAKE (SOREMADE!)
  // Si el estado proyectado detecta victoria matemática (Ippon directo, 2 Waza-aris,
  // 3 Shidos o expulsión directa), el cronómetro principal se congela automáticamente.
  // ============================================================================
  useEffect(() => {
    if (projection.is_mathematical_victory && isClockRunning) {
      setIsClockRunning(false);
      setActiveOsaekomi(null);
      setMatchStatus((prev) => (prev === 'ONGOING' ? 'PAUSED' : prev));
      dispatchEvent('STOP_CLOCK', null, { reason: 'AUTOMATIC_STOP_SOREMADE' });
    }
  }, [projection.is_mathematical_victory, isClockRunning, dispatchEvent]);

  // ============================================================================
  // CORRECCIÓN 3: CIERRE MANUAL Y DECLARACIÓN CONSCIENTE (ENTER)
  // El combate NO puede sellarse si no hay un ganador definido (winner === null).
  // El modal SOLO se activa si hubo un Hansoku-Make DIRECTO intencional.
  // ============================================================================
  const declareFinish = useCallback(() => {
    // CORRECCIÓN 3: Candado de Cierre sin Ganador
    if (!projection.winner) {
      triggerWarning('No hay un ganador definido. El combate no puede finalizarse sin resultado.');
      return;
    }

    if (projection.has_direct_hansoku_make) {
      setShowHansokuModal(true);
      return;
    }

    setIsClockRunning(false);
    setMatchStatus('FINISHED');
    dispatchEvent('DECLARATION_FINISH', null);
  }, [dispatchEvent, projection.has_direct_hansoku_make, projection.winner, triggerWarning]);

  // ============================================================================
  // ENLACE CON HOOK DE ATAJOS DE TECLADO
  // ============================================================================
  useTatamiShortcuts({
    onAddAction: (action, target) => {
      if (action === 'START_OSAEKOMI') {
        startOsaekomi(target);
      } else {
        dispatchEvent(action, target);
      }
    },
    onUndoSpecificAction: handleUndoSpecificAction,
    onToggleClock: toggleClock,
    onStopOsaekomi: stopOsaekomi,
    onSwapOsaekomi: swapOsaekomi,
    onDeclareFinish: declareFinish,
    isEnabled: matchStatus !== 'FINISHED' && !showHansokuModal,
  });

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white select-none font-sans overflow-hidden relative">
      {/* ALERTA FLOTANTE: CANDADOS DE REGLAMENTO EN TIEMPO REAL */}
      {validationWarning && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-2xl border-2 border-amber-300 flex items-center space-x-2 animate-bounce">
          <span className="text-base">⚠️</span>
          <span className="text-xs uppercase tracking-wide">{validationWarning}</span>
        </div>
      )}

      {/* BARRA SUPERIOR: ESTADO DEL TATAMI Y METADATOS */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-4">
          <span className="text-xl font-black tracking-wider text-amber-400">
            TATAMI {initialMatch.tatami_number}
          </span>
          <span className="text-sm px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {initialMatch.category_name || 'Categoría Oficial'} • Combate #{initialMatch.match_number}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Persistencia IndexedDB Activa</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider ${
              matchStatus === 'ONGOING'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                : matchStatus === 'PAUSED'
                ? 'bg-amber-950 text-amber-400 border border-amber-700'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {matchStatus}
          </span>
        </div>
      </header>

      {/* CUERPO PRINCIPAL: PANTALLA DIVIDIDA POR HEMISFERIOS */}
      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* ==================================================================== */}
        {/* HEMISFERIO IZQUIERDO: ATLETA BLANCO (HOTKEYS: Q, W, E, R, A) */}
        {/* ==================================================================== */}
        <section className="col-span-5 bg-white text-slate-900 p-6 flex flex-col justify-between border-r-4 border-slate-900">
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
              <span className="text-xs font-black tracking-widest text-slate-500 uppercase">
                BLANCO (SHIRO)
              </span>
              <span className="text-xs text-slate-400 font-mono">Shift + Key = Deshacer</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight mt-2 text-slate-900 truncate">
              {initialMatch.white_athlete_name}
            </h2>
            <p className="text-sm font-semibold text-slate-600 truncate">
              {initialMatch.white_club_name}
            </p>
          </div>

          {/* Marcadores Numéricos Blanco */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">IPPON [Q]</span>
              <span className="text-6xl font-black text-slate-950">
                {projection.white_score.ippon}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">WAZA-ARI [W]</span>
              <span className="text-6xl font-black text-blue-700">
                {projection.white_score.wazaari}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">YUKO [E]</span>
              <span className="text-6xl font-black text-amber-600">
                {projection.white_score.yuko}
              </span>
            </div>
          </div>

          {/* Sanciones Shido y Retención Osaekomi Blanco */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-red-700">SHIDOS [R]:</span>
                <div className="flex space-x-1.5">
                  {[1, 2, 3].map((num) => (
                    <span
                      key={num}
                      className={`w-4 h-6 rounded-sm border ${
                        projection.white_score.shido >= num
                          ? 'bg-amber-500 border-amber-600'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {projection.white_score.has_hansoku_make_direct && (
                  <span className="text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                    HANSOKU-MAKE DIRECTO
                  </span>
                )}
                {projection.white_score.has_hansoku_make_indirect && (
                  <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded">
                    3 SHIDOS (TÉCNICO)
                  </span>
                )}
                {!projection.white_score.has_hansoku_make && (
                  <button
                    onClick={() => dispatchEvent('ADD_HANSOKU_MAKE', 'WHITE')}
                    className="text-2xs font-bold text-red-700 hover:text-red-900 bg-red-100 px-2 py-0.5 rounded border border-red-300"
                    title="Descalificación Directa (Hansoku-Make)"
                  >
                    Expulsión [T]
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => startOsaekomi('WHITE')}
              className={`w-full py-4 rounded-xl font-black text-lg tracking-wider uppercase transition shadow-md ${
                activeOsaekomi === 'WHITE'
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              OSAEKOMI BLANCO [A]
            </button>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* PANEL CENTRAL: CRONÓMETRO, OSAEKOMI GAUGE Y ESTADO DE COMBATE */}
        {/* ==================================================================== */}
        <section className="col-span-2 bg-slate-950 p-4 flex flex-col justify-between items-center border-r border-slate-800">
          <div className="w-full text-center space-y-1">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">
              TIEMPO DE COMBATE
            </span>
            <div
              className={`text-6xl font-black font-mono tracking-tighter cursor-pointer ${
                matchTimeRemaining === 0
                  ? 'text-red-500 animate-pulse'
                  : isClockRunning
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
              onClick={toggleClock}
            >
              {formatTime(matchTimeRemaining)}
            </div>
            <span className="text-xs text-slate-500 font-mono">[Espacio] Hajime / Mate</span>
          </div>

          {/* Cronómetro de Retención Osaekomi */}
          <div className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              OSAEKOMI
            </span>
            <div
              className={`text-5xl font-black font-mono ${
                activeOsaekomi ? 'text-amber-400 animate-bounce' : 'text-slate-600'
              }`}
            >
              {String(osaekomiSeconds).padStart(2, '0')}&quot;
            </div>
            {activeOsaekomi && (
              <span className="inline-block text-xs font-extrabold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                RETENIENDO: {activeOsaekomi}
              </span>
            )}
            <div className="flex space-x-1 pt-1">
              <button
                onClick={stopOsaekomi}
                className="flex-1 py-1 text-xs font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Toketa [S]
              </button>
              <button
                onClick={swapOsaekomi}
                className="flex-1 py-1 text-xs font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Swap [X]
              </button>
            </div>
          </div>

          {/* Aviso de Victoria Matemática */}
          {projection.is_mathematical_victory && (
            <div className="w-full p-3 rounded-lg bg-emerald-950 border border-emerald-600 text-center text-xs space-y-1">
              <span className="font-black text-emerald-400 tracking-wider uppercase block">
                VICTORIA {projection.winner}
              </span>
              <span className="text-emerald-200 text-2xs block truncate">
                {projection.win_reason}
              </span>
              <span className="text-2xs text-emerald-400/80 block">Presiona Enter para cerrar</span>
            </div>
          )}

          {/* Botón de Declaración Consciente */}
          <button
            onClick={declareFinish}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider transition"
          >
            Finalizar Combate [Enter]
          </button>
        </section>

        {/* ==================================================================== */}
        {/* HEMISFERIO DERECHO: ATLETA AZUL (HOTKEYS: U, I, O, P, L) */}
        {/* ==================================================================== */}
        <section className="col-span-5 bg-blue-700 text-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-blue-600">
              <span className="text-xs font-black tracking-widest text-blue-200 uppercase">
                AZUL (AO)
              </span>
              <span className="text-xs text-blue-300 font-mono">Shift + Key = Deshacer</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight mt-2 text-white truncate">
              {initialMatch.blue_athlete_name}
            </h2>
            <p className="text-sm font-semibold text-blue-200 truncate">
              {initialMatch.blue_club_name}
            </p>
          </div>

          {/* Marcadores Numéricos Azul */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="flex flex-col items-center justify-center p-4 bg-blue-800/80 rounded-xl border border-blue-500">
              <span className="text-xs font-bold text-blue-200">IPPON [U]</span>
              <span className="text-6xl font-black text-white">
                {projection.blue_score.ippon}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-blue-800/80 rounded-xl border border-blue-500">
              <span className="text-xs font-bold text-blue-200">WAZA-ARI [I]</span>
              <span className="text-6xl font-black text-white">
                {projection.blue_score.wazaari}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-blue-800/80 rounded-xl border border-blue-500">
              <span className="text-xs font-bold text-blue-200">YUKO [O]</span>
              <span className="text-6xl font-black text-white">
                {projection.blue_score.yuko}
              </span>
            </div>
          </div>

          {/* Sanciones Shido y Retención Osaekomi Azul */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-900/60 rounded-lg border border-blue-600">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-blue-200">SHIDOS [P]:</span>
                <div className="flex space-x-1.5">
                  {[1, 2, 3].map((num) => (
                    <span
                      key={num}
                      className={`w-4 h-6 rounded-sm border ${
                        projection.blue_score.shido >= num
                          ? 'bg-amber-400 border-amber-300'
                          : 'bg-blue-950 border-blue-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {projection.blue_score.has_hansoku_make_direct && (
                  <span className="text-xs font-black bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                    HANSOKU-MAKE DIRECTO
                  </span>
                )}
                {projection.blue_score.has_hansoku_make_indirect && (
                  <span className="text-xs font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                    3 SHIDOS (TÉCNICO)
                  </span>
                )}
                {!projection.blue_score.has_hansoku_make && (
                  <button
                    onClick={() => dispatchEvent('ADD_HANSOKU_MAKE', 'BLUE')}
                    className="text-2xs font-bold text-red-200 hover:text-white bg-red-950/80 px-2 py-0.5 rounded border border-red-700"
                    title="Descalificación Directa (Hansoku-Make)"
                  >
                    Expulsión [Y]
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => startOsaekomi('BLUE')}
              className={`w-full py-4 rounded-xl font-black text-lg tracking-wider uppercase transition shadow-md ${
                activeOsaekomi === 'BLUE'
                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-slate-950 text-white hover:bg-slate-900 border border-blue-500'
              }`}
            >
              OSAEKOMI AZUL [L]
            </button>
          </div>
        </section>
      </main>

      {/* PANEL INFERIOR: PILA DE AUDITORÍA DE EVENTOS (EVENT STREAM) */}
      <footer className="h-28 bg-slate-900 border-t border-slate-800 px-6 py-2 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Registro Inmutable de Eventos ({events.length} acciones)
          </span>
          <span className="text-2xs text-slate-500 font-mono">
            Event Sourcing Stack • Los eventos tachados representan correcciones (Undo)
          </span>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          {events.length === 0 ? (
            <span className="text-xs text-slate-600 italic">No hay acciones registradas aún.</span>
          ) : (
            [...events].reverse().map((ev) => (
              <div
                key={ev.id}
                className={`flex-shrink-0 px-2.5 py-1 rounded text-xs border font-mono ${
                  ev.is_undone
                    ? 'bg-slate-950/40 text-slate-600 border-slate-800 line-through'
                    : ev.target === 'WHITE'
                    ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                    : ev.target === 'BLUE'
                    ? 'bg-blue-900 text-blue-100 border-blue-700 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                #{ev.sequence_number} {ev.action} {ev.target ? `[${ev.target}]` : ''} @ {ev.match_time}
              </div>
            ))
          )}
        </div>
      </footer>

      {/* MODAL DIFERIDO DE HANSOKU-MAKE (Tipificación Técnica vs Disciplinaria) */}
      {showHansokuModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5">
            <h3 className="text-xl font-bold text-white">Tipificación de Hansoku-Make</h3>
            <p className="text-sm text-slate-300">
              Se ha registrado una descalificación directa. Según el reglamento IJF, debes especificar
              si la falta es Técnica o Disciplinaria (esta última anula puntos de ranking acumulados).
            </p>

            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name="hansoku"
                  checked={selectedHansokuType === 'TECHNICAL'}
                  onChange={() => setSelectedHansokuType('TECHNICAL')}
                  className="text-blue-600"
                />
                <div>
                  <span className="text-sm font-bold text-white block">Falta Técnica (No grave)</span>
                  <span className="text-xs text-slate-400 block">Pierde el combate pero conserva puntos previos</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name="hansoku"
                  checked={selectedHansokuType === 'DISCIPLINARY'}
                  onChange={() => setSelectedHansokuType('DISCIPLINARY')}
                  className="text-blue-600"
                />
                <div>
                  <span className="text-sm font-bold text-red-400 block">Falta Disciplinaria (Grave)</span>
                  <span className="text-xs text-slate-400 block">Acto antideportivo: Expulsión y anulación de puntos</span>
                </div>
              </label>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowHansokuModal(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold text-sm"
              >
                Volver al Combate
              </button>
              <button
                onClick={() => {
                  setShowHansokuModal(false);
                  setIsClockRunning(false);
                  setMatchStatus('FINISHED');
                  dispatchEvent('DECLARATION_FINISH', null, { hansoku_type: selectedHansokuType });
                }}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
              >
                Confirmar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
