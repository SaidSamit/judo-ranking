// ==============================================================================
// MOTOR DE PERSISTENCIA LOCAL OFFLINE-FIRST (INDEXEDDB CON IDB)
// ==============================================================================
//
// ¿POR QUÉ INDEXEDDB?
// LocalStorage tiene un límite de ~5MB, es síncrono (bloquea el hilo principal
// de renderizado) y no soporta índices ni transacciones ACID.
// IndexedDB es asíncrono, transaccional y puede almacenar cientos de megabytes
// de eventos de combate sin degradar los 60 FPS del cronómetro de la mesa.
//
// ==============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MatchEvent } from '@/types/events';

export interface LocalMatch {
  id: string;
  tournament_id: string;
  category_id: string;
  category_name?: string;
  tatami_number: number;
  match_number: number;
  white_athlete_name: string;
  white_club_name: string;
  blue_athlete_name: string;
  blue_club_name: string;
  match_duration_seconds: number;
  status: 'SCHEDULED' | 'ONGOING' | 'PAUSED' | 'FINISHED' | 'PENDING';
  current_time_seconds: number;
  winner_id?: string | null;
  win_reason?: string | null;
  white_athlete_id?: string | null;
  blue_athlete_id?: string | null;
  next_match_id?: string | null;
  next_match_slot?: 'WHITE' | 'BLUE' | null;
  updated_at: string;
}

interface JudoDB extends DBSchema {
  matches: {
    key: string;
    value: LocalMatch;
    indexes: {
      by_tatami: number;
    };
  };
  events: {
    key: string;
    value: MatchEvent;
    indexes: {
      by_match: string;
      by_match_seq: [string, number];
      by_unsynced: number; // 0 = false, 1 = true (IndexedDB no indexa booleanos nativamente en todos los navegadores)
    };
  };
}

const DB_NAME = 'judo_tatami_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<JudoDB>> | null = null;

/**
 * Inicializa y retorna la instancia singleton de la base de datos local IndexedDB.
 */
export function getLocalDB(): Promise<IDBPDatabase<JudoDB>> {
  if (typeof window === 'undefined') {
    // Si se ejecuta del lado del servidor (SSR), retorna promesa que no hace nada
    return Promise.reject(new Error('IndexedDB solo está disponible en el entorno del navegador.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<JudoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Almacén de Combates
        if (!db.objectStoreNames.contains('matches')) {
          const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
          matchStore.createIndex('by_tatami', 'tatami_number');
        }

        // 2. Almacén de Eventos (Pila inmutable de Event Sourcing)
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('by_match', 'match_id');
          eventStore.createIndex('by_match_seq', ['match_id', 'sequence_number']);
          eventStore.createIndex('by_unsynced', 'synced_to_cloud');
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Guarda o actualiza un combate en la base de datos local.
 */
export async function saveMatchLocally(match: LocalMatch): Promise<void> {
  const db = await getLocalDB();
  await db.put('matches', match);
}

/**
 * Obtiene un combate desde la base de datos local por su ID.
 */
export async function getLocalMatch(matchId: string): Promise<LocalMatch | undefined> {
  const db = await getLocalDB();
  return db.get('matches', matchId);
}

/**
 * Agrega un nuevo evento a la pila local con garantía atómica.
 */
export async function appendLocalEvent(event: MatchEvent): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('events', 'readwrite');
  await tx.store.put(event);
  await tx.done;
}

/**
 * Obtiene toda la secuencia de eventos de un combate, ordenada cronológicamente.
 */
export async function getMatchEventsLocally(matchId: string): Promise<MatchEvent[]> {
  const db = await getLocalDB();
  const events = await db.getAllFromIndex('events', 'by_match', matchId);
  return events.sort((a, b) => a.sequence_number - b.sequence_number);
}

/**
 * Marca un evento específico como revertido (is_undone = true),
 * respetando la inmutabilidad y registrando qué evento causó la anulación.
 */
export async function markEventUndoneLocally(
  eventId: string,
  undoneByEventId: string
): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('events', 'readwrite');
  const event = await tx.store.get(eventId);

  if (event) {
    event.is_undone = true;
    event.undone_by_event_id = undoneByEventId;
    event.synced_to_cloud = false; // Requiere resincronizar este cambio al backend
    await tx.store.put(event);
  }

  await tx.done;
}

/**
 * Obtiene los eventos que aún no han sido replicados al backend de Supabase.
 */
export async function getUnsyncedEventsLocally(matchId: string): Promise<MatchEvent[]> {
  const events = await getMatchEventsLocally(matchId);
  return events.filter((e) => !e.synced_to_cloud);
}

/**
 * Marca una lista de IDs de eventos como replicados exitosamente a la nube.
 */
export async function markEventsAsSyncedLocally(eventIds: string[]): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('events', 'readwrite');

  for (const id of eventIds) {
    const event = await tx.store.get(id);
    if (event) {
      event.synced_to_cloud = true;
      await tx.store.put(event);
    }
  }

  await tx.done;
}
