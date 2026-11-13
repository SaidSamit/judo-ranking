// ==============================================================================
// HOOK DE SINCRONIZACIÓN REALTIME BROADCAST (SUPABASE WEBSOCKETS)
// ==============================================================================
//
// ¿POR QUÉ BROADCAST EN LUGAR DE POSTGRES_CHANGES?
// 1. Latencia < 20ms: Broadcast viaja directamente en memoria a través del servidor
//    Phoenix/Elixir de Supabase Realtime, sin esperar a que PostgreSQL escriba en disco.
// 2. Cero Saturación de Base de Datos: Un cronómetro emite 1 tick por segundo (y hasta
//    5 por segundo durante Osaekomi). Escribir cada tick en disco saturaría el WAL
//    (Write-Ahead Logging) y provocaría cuellos de botella severos.
// 3. Efímero vs Persistente: La TV solo necesita el estado "vivo" en pantalla. Los eventos
//    oficiales del combate se persisten silenciosamente en segundo plano vía Sync Engine.
//
// ==============================================================================

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createStationClient } from '@/lib/supabase/station-client';
import { BroadcastMatchPayload } from '@/types/events';
import { RealtimeChannel } from '@supabase/supabase-js';

export type BroadcastMode = 'EMITTER' | 'RECEIVER';
export type ConnectionStatus = 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR';

const BROADCAST_EVENT_NAME = 'MATCH_STATE_UPDATE';
const SYNC_REQUEST_EVENT_NAME = 'REQUEST_STATE_SYNC';

interface UseRealtimeBroadcastOptions {
  channelName: string;                     // Ej: 'tatami-1' o 'match-xyz'
  mode: BroadcastMode;
  accessToken?: string;                    // Token JWT de estación si es emisor autenticado
  onStateReceived?: (payload: BroadcastMatchPayload) => void;
  onSyncRequested?: () => void;
}

export function useRealtimeBroadcast({
  channelName,
  mode,
  accessToken,
  onStateReceived,
  onSyncRequested,
}: UseRealtimeBroadcastOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [lastReceivedState, setLastReceivedState] = useState<BroadcastMatchPayload | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onStateReceivedRef = useRef(onStateReceived);
  const onSyncRequestedRef = useRef(onSyncRequested);

  // Mantener la referencia actualizada de las callbacks sin provocar reconexiones del useEffect
  useEffect(() => {
    onStateReceivedRef.current = onStateReceived;
  }, [onStateReceived]);

  useEffect(() => {
    onSyncRequestedRef.current = onSyncRequested;
  }, [onSyncRequested]);

  useEffect(() => {
    if (!channelName) return;

    setConnectionStatus('CONNECTING');

    // 1. Instanciar el cliente adecuado (con token de estación si existe, o cliente anónimo público)
    const supabase = accessToken ? createStationClient(accessToken) : createClient();

    // 2. Crear canal de Supabase Realtime
    // En modo Broadcast, no nos suscribimos al WAL de PostgreSQL.
    // self: false evita que el emisor reciba sus propios ecos si está suscrito al mismo canal.
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false, ack: false },
      },
    });

    channelRef.current = channel;

    // 3. Configurar escucha según el rol (RECEPTOR recibe estados; EMISOR responde a solicitudes de sync)
    if (mode === 'RECEIVER') {
      channel.on(
        'broadcast',
        { event: BROADCAST_EVENT_NAME },
        ({ payload }: { payload: BroadcastMatchPayload }) => {
          setLastReceivedState(payload);
          if (onStateReceivedRef.current) {
            onStateReceivedRef.current(payload);
          }
        }
      );
    } else if (mode === 'EMITTER') {
      channel.on('broadcast', { event: SYNC_REQUEST_EVENT_NAME }, () => {
        if (onSyncRequestedRef.current) {
          onSyncRequestedRef.current();
        }
      });
    }

    // 4. Suscribirse al canal WebSocket
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('SUBSCRIBED');
        if (mode === 'RECEIVER') {
          channel
            .send({
              type: 'broadcast',
              event: SYNC_REQUEST_EVENT_NAME,
              payload: { requestedAt: Date.now() },
            })
            .catch(() => {});
        }
      } else if (status === 'CLOSED') {
        setConnectionStatus('DISCONNECTED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionStatus('ERROR');
      }
    });

    // 5. Cleanup al desmontar el componente
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('DISCONNECTED');
    };
  }, [channelName, mode, accessToken]);

  // ============================================================================
  // FUNCIÓN PARA TRANSMITIR ESTADO (MODO EMISOR - MESA DE TATAMI)
  // ============================================================================
  const broadcastState = useCallback(
    async (payload: BroadcastMatchPayload) => {
      if (mode !== 'EMITTER') {
        console.warn('broadcastState fue invocado en un cliente configurado como RECEIVER.');
        return;
      }

      if (!channelRef.current || connectionStatus !== 'SUBSCRIBED') {
        // Si el canal aún se está conectando, no bloqueamos el flujo de la mesa
        return;
      }

      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: BROADCAST_EVENT_NAME,
          payload: {
            ...payload,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        console.error('Error enviando broadcast de realtime:', err);
      }
    },
    [mode, connectionStatus]
  );

  return {
    broadcastState,
    lastReceivedState,
    connectionStatus,
    isSubscribed: connectionStatus === 'SUBSCRIBED',
  };
}
