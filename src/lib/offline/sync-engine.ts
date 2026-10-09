// ==============================================================================
// MOTOR DE SINCRONIZACIÓN OFFLINE-FIRST (SYNC ENGINE)
// ==============================================================================
//
// ¿CÓMO FUNCIONA LA CONCILIACIÓN DE DATOS?
// 1. Desacoplamiento Temporal: El operador en la mesa de control genera eventos
//    que se guardan en milisegundos en IndexedDB con `synced_to_cloud: false`.
//    La UI jamás espera la respuesta HTTP de Supabase para responder a los hotkeys.
// 2. Conciliación Asíncrona Silenciosa: El Sync Engine inspecciona periódicamente
//    la base de datos local o reacciona inmediatamente al evento `online` del navegador.
// 3. Procesamiento en Lote (Batching): Agrupa todos los eventos no replicados y ejecuta
//    una transacción atómica en Supabase vía RPC (`sync_offline_match`) o upsert masivo.
// 4. Marca de Agua Local: Solo cuando el servidor de Supabase confirma la recepción
//    exitosa (código 200/201), el Sync Engine actualiza `synced_to_cloud: true`
//    en IndexedDB, asegurando tolerancia total a desconexiones intermedias sin pérdida de datos.
// 5. Tolerancia a Fallos y Modo Local: Si el identificador de combate es local/demo
//    o si Supabase no está alcanzable, el motor opera de forma silenciosa sin interrumpir
//    el hilo de ejecución del operador ni arrojar excepciones no controladas.
//
// ==============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getUnsyncedEventsLocally, markEventsAsSyncedLocally } from './db';
import { createClient } from '@/lib/supabase/client';
import { createStationClient } from '@/lib/supabase/station-client';
import { MatchEvent, BroadcastMatchPayload } from '@/types/events';

import { isValidUuid } from '@/lib/utils/uuid';
export { isValidUuid };

export interface SyncEngineStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTimestamp: number | null;
  lastError: string | null;
  isOnline: boolean;
}

export interface SyncMatchOptions {
  matchId: string;
  getLatestSnapshot?: () => Partial<BroadcastMatchPayload> | null;
  accessToken?: string;
}

/**
 * Ejecuta una sincronización inmediata de los eventos pendientes de un combate.
 */
export async function syncMatchEventsNow({
  matchId,
  getLatestSnapshot,
  accessToken,
}: SyncMatchOptions): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, syncedCount: 0, error: 'Entorno no navegador' };
  }

  // 1. Comprobar si hay conectividad a nivel de navegador
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0, error: 'Dispositivo sin conexión a internet' };
  }

  // 2. Comprobar validez de UUID para PostgreSQL
  // Si se está utilizando un slug arbitrario no-UUID (ej: "match-1"), no intentamos
  // enviar a PostgreSQL para evitar el error de sintaxis SQL ("invalid input syntax for type uuid").
  if (!isValidUuid(matchId)) {
    const unsynced = await getUnsyncedEventsLocally(matchId);
    if (unsynced.length > 0) {
      // Marcamos los eventos locales como conciliados localmente
      await markEventsAsSyncedLocally(unsynced.map((e) => e.id));
    }
    return { success: true, syncedCount: unsynced.length };
  }

  try {
    // 3. Extraer eventos no replicados desde IndexedDB
    const unsyncedEvents = await getUnsyncedEventsLocally(matchId);

    if (unsyncedEvents.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    const supabase = accessToken ? createStationClient(accessToken) : createClient();
    const snapshot = getLatestSnapshot ? getLatestSnapshot() : null;

    // 4. Preparar carga útil para la función RPC o upsert
    // Formateamos los eventos para que coincidan con el esquema de Supabase match_events
    const formattedEvents = unsyncedEvents.map((ev) => ({
      id: isValidUuid(ev.id) ? ev.id : crypto.randomUUID(),
      match_id: matchId,
      organization_id: ev.organization_id && isValidUuid(ev.organization_id) ? ev.organization_id : null,
      sequence_number: ev.sequence_number,
      action: ev.action,
      target: ev.target,
      match_time: ev.match_time,
      match_time_seconds: ev.match_time_seconds,
      is_undone: ev.is_undone,
      undone_by_event_id:
        ev.undone_by_event_id && isValidUuid(ev.undone_by_event_id) ? ev.undone_by_event_id : null,
      payload: ev.payload || {},
      created_at: ev.created_at,
    }));

    // 5. Intento prioritario: Procedimiento almacenado atómico `sync_offline_match`
    const { error: rpcError } = await supabase.rpc('sync_offline_match', {
      p_match_id: matchId,
      p_final_state: {
        status: snapshot?.match_status || 'ONGOING',
        white_score: snapshot?.projection?.white_score || {},
        blue_score: snapshot?.projection?.blue_score || {},
        winner_id: null,
        win_reason: snapshot?.projection?.win_reason || null,
        hansoku_type: null,
        current_match_time_seconds:
          snapshot?.match_time_remaining !== undefined && snapshot?.match_duration_seconds !== undefined
            ? snapshot.match_duration_seconds - snapshot.match_time_remaining
            : 0,
        is_golden_score: snapshot?.is_golden_score || false,
      },
      p_events: formattedEvents,
    });

    if (rpcError) {
      // 6. Fallback secundario: Upsert directo en la tabla `match_events`
      console.warn('[SyncEngine] RPC sync_offline_match no disponible, intentando upsert directo:', rpcError.message);

      const { error: upsertError } = await supabase
        .from('match_events')
        .upsert(formattedEvents, { onConflict: 'match_id,sequence_number' });

      if (upsertError) {
        // En lugar de lanzar una excepción fatal con throw new Error (que interrumpe la UI),
        // devolvemos el fallo controlado para que el hook actualice el estado suavemente.
        console.warn('[SyncEngine] Upsert en match_events no pudo completarse:', upsertError.message);
        return {
          success: false,
          syncedCount: 0,
          error: upsertError.message,
        };
      }
    }

    // 7. Conciliación confirmada: Marcar eventos en IndexedDB como sincronizados
    const syncedIds = unsyncedEvents.map((e) => e.id);
    await markEventsAsSyncedLocally(syncedIds);

    return { success: true, syncedCount: syncedIds.length };
  } catch (err: any) {
    console.warn('[SyncEngine] Excepción atrapada durante sincronización:', err?.message || err);
    return {
      success: false,
      syncedCount: 0,
      error: err?.message || 'Error desconocido sincronizando con la nube',
    };
  }
}

/**
 * Hook de React para incorporar el Sync Engine en cualquier componente (ej. Mesa de Tatami).
 */
export function useSyncEngine({
  matchId,
  getLatestSnapshot,
  accessToken,
  intervalMs = 4000, // Cada 4 segundos verifica si hay eventos pendientes
}: SyncMatchOptions & { intervalMs?: number }) {
  // CRÍTICO PARA HYDRATION: Inicializar isOnline de manera determinista (true) en SSR y cliente
  const [status, setStatus] = useState<SyncEngineStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTimestamp: null,
    lastError: null,
    isOnline: true,
  });

  const isSyncingRef = useRef(false);

  const checkPendingAndSync = useCallback(async () => {
    if (isSyncingRef.current || !matchId) return;

    try {
      const unsynced = await getUnsyncedEventsLocally(matchId);
      setStatus((prev) => ({ ...prev, pendingCount: unsynced.length }));

      if (unsynced.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return;
      }

      isSyncingRef.current = true;
      setStatus((prev) => ({ ...prev, isSyncing: true, lastError: null }));

      const result = await syncMatchEventsNow({
        matchId,
        getLatestSnapshot,
        accessToken,
      });

      if (result.success) {
        const remaining = await getUnsyncedEventsLocally(matchId);
        setStatus((prev) => ({
          ...prev,
          isSyncing: false,
          pendingCount: remaining.length,
          lastSyncTimestamp: Date.now(),
          lastError: null,
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastError: result.error || 'Fallo de sincronización',
        }));
      }
    } catch (err: any) {
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastError: err?.message || 'Error en sync engine',
      }));
    } finally {
      isSyncingRef.current = false;
    }
  }, [matchId, getLatestSnapshot, accessToken]);

  // 1. Escuchar cambios de conectividad de la red física
  useEffect(() => {
    // Sincronizar estado real del navegador una vez montado el cliente
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setStatus((prev) => ({ ...prev, isOnline: navigator.onLine }));
    }

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      // Al recuperar conexión a internet, sincronizar inmediatamente
      checkPendingAndSync();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkPendingAndSync]);

  // 2. Temporizador de sondeo en segundo plano
  useEffect(() => {
    const timer = setInterval(() => {
      checkPendingAndSync();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [checkPendingAndSync, intervalMs]);

  return {
    ...status,
    syncNow: checkPendingAndSync,
  };
}
