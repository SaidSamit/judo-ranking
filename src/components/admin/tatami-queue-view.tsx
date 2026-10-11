// ==============================================================================
// COMPONENTE CLIENTE: DASHBOARD DE COLA DE TATAMI (TATAMI QUEUE VIEW)
// ==============================================================================

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Play,
  CheckCircle2,
  Clock,
  Swords,
  Users,
  ChevronRight,
  Tv,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { getTatamiQueueMatchesAction, resequenceTatamiMatchesAction } from '@/app/actions/brackets';
import { createClient } from '@/lib/supabase/client';

interface QueueMatch {
  id: string;
  match_number: number;
  category_name: string;
  round_name: string;
  white_athlete_name: string;
  white_club_name: string;
  blue_athlete_name: string;
  blue_club_name: string;
  status: 'SCHEDULED' | 'ONGOING' | 'FINISHED' | 'PENDING';
  current_time_seconds?: number;
}

interface TatamiQueueViewProps {
  tatamiNumber: number;
  rawId: string;
  tournamentId?: string;
  tournamentName?: string;
  tatamiCount?: number;
}

export function TatamiQueueView({
  tatamiNumber,
  rawId,
  tournamentId,
  tournamentName,
  tatamiCount = 2,
}: TatamiQueueViewProps) {
  const router = useRouter();
  const [matches, setMatches] = useState<QueueMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResequencing, setIsResequencing] = useState(false);
  const [resequenceMessage, setResequenceMessage] = useState<string | null>(null);

  // Cargar combates asignados al tatami en este torneo
  const loadMatches = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const res = await getTatamiQueueMatchesAction(tatamiNumber, tournamentId);
        if (res.success && res.matches.length > 0) {
          const mapped: QueueMatch[] = res.matches.map((m: any) => ({
            id: m.id,
            match_number: m.match_number,
            category_name: m.category?.name || 'Categoría Oficial',
            round_name: m.round_name || m.round || 'Ronda Oficial',
            white_athlete_name: m.white_athlete_name || 'Por definir',
            white_club_name: m.white_club_name || 'Independiente',
            blue_athlete_name: m.blue_athlete_name || 'Por definir',
            blue_club_name: m.blue_club_name || 'Independiente',
            status: m.status || 'SCHEDULED',
          }));
          setMatches(mapped);
        } else {
          setMatches([]);
        }
      } catch (err: any) {
        console.error(err);
        if (!isSilent) setMatches([]);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [tatamiNumber, tournamentId]
  );

  useEffect(() => {
    // 1. Carga inicial
    loadMatches(false);

    // 2. Suscripción en tiempo real a Supabase (eventos en tabla matches)
    const supabase = createClient();
    const channel = supabase
      .channel(`tatami-queue-view-${tatamiNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tatami_number=eq.${tatamiNumber}`,
        },
        () => {
          loadMatches(true);
        }
      )
      .subscribe();

    // 3. Intervalo de sondeo (polling de respaldo cada 5s para alta resiliencia)
    const pollTimer = setInterval(() => {
      loadMatches(true);
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollTimer);
    };
  }, [loadMatches, tatamiNumber]);

  // Manejador para compactar y renumerar correlativos (1, 2, 3...)
  const handleResequence = async () => {
    if (!tournamentId) return;
    setIsResequencing(true);
    setResequenceMessage(null);
    try {
      const res = await resequenceTatamiMatchesAction(tournamentId, tatamiNumber);
      if (res.success) {
        setResequenceMessage('¡Correlativos renumerados con éxito!');
        await loadMatches(false);
        setTimeout(() => setResequenceMessage(null), 3500);
      } else {
        setResequenceMessage('Error al renumerar: ' + (res.error || ''));
      }
    } catch (err: any) {
      setResequenceMessage('Error: ' + err.message);
    } finally {
      setIsResequencing(false);
    }
  };

  // Métricas de la cola del tatami
  const stats = useMemo(() => {
    const total = matches.length;
    const scheduled = matches.filter((m) => m.status === 'SCHEDULED').length;
    const pending = matches.filter((m) => m.status === 'PENDING').length;
    const ongoing = matches.filter((m) => m.status === 'ONGOING').length;
    const finished = matches.filter((m) => m.status === 'FINISHED').length;
    return { total, scheduled, pending, ongoing, finished };
  }, [matches]);

  // Identificar el ID del primer combate que está listo para entrar al tatami
  const firstScheduledId = useMemo(() => {
    return matches.find((m) => m.status === 'SCHEDULED')?.id;
  }, [matches]);

  // Manejador: Llamar a Tatami (Redirigir al motor de arbitraje)
  const handleCallToTatami = (matchId: string) => {
    router.push(`/tatami/${matchId}`);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* CABECERA Y SELECTOR DE TATAMI */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          {tournamentId && (
            <Link
              href={`/admin/tournaments/${tournamentId}?tab=brackets`}
              className="inline-flex items-center space-x-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a {tournamentName || 'Campeonato'}</span>
            </Link>
          )}

          <div className="flex items-center space-x-2">
            <Monitor className="w-7 h-7 text-amber-400" />
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Cola de Combates • Tatami #{tatamiNumber}
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Secuencia oficial de combates programados. Al presionar{' '}
            <strong className="text-amber-400">&quot;Llamar a Tatami&quot;</strong>, el sistema
            cargará el combate directamente en la Mesa de Control para iniciar el arbitraje.
          </p>
        </div>

        {/* Selector Dinámico de Tatamis según tatamiCount del campeonato */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-bold overflow-x-auto">
          {Array.from({ length: tatamiCount }, (_, i) => i + 1).map((num) => (
            <Link
              key={num}
              href={`/admin/tatami/${num}`}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                tatamiNumber === num
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Tatami {num}
            </Link>
          ))}
        </div>
      </header>

      {/* MÉTRICAS DE LA COLA */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block font-bold">Total Combates</span>
          <span className="text-2xl font-black text-white mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-blue-400 block font-bold">Listos (Cola)</span>
          <span className="text-2xl font-black text-blue-400 mt-1 block">
            {stats.scheduled}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block font-bold">En Espera (Árbol)</span>
          <span className="text-2xl font-black text-slate-400 mt-1 block">
            {stats.pending}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-amber-400 block font-bold">En Curso (Tatami)</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{stats.ongoing}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-emerald-400 block font-bold">Finalizados</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {stats.finished}
          </span>
        </div>
      </section>

      {/* LISTA SECUENCIAL DE COMBATES EN COLA */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Swords className="w-5 h-5 text-amber-400" />
              <span className="text-base font-bold text-white">
                Secuencia Cronológica del Tatami #{tatamiNumber}
              </span>
            </div>
            {/* Indicador de Sincronización en Tiempo Real */}
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-[10px] text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tiempo Real</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {tournamentId && (
              <button
                type="button"
                onClick={handleResequence}
                disabled={isResequencing || loading || matches.length === 0}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 transition shadow-sm"
                title="Compactar y renumerar correlativos continuos (1, 2, 3...) sin huecos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResequencing ? 'animate-spin' : ''}`} />
                <span>{isResequencing ? 'Renumerando...' : 'Renumerar (1, 2, 3...)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => loadMatches(false)}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            <Link
              href={`/scoreboard/tatami-${tatamiNumber}`}
              target="_blank"
              className="text-xs font-bold text-slate-300 hover:text-white flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            >
              <Tv className="w-4 h-4 text-emerald-400" />
              <span>Marcador TV</span>
            </Link>
          </div>
        </div>

        {/* Notificación de Renumeración */}
        {resequenceMessage && (
          <div className="bg-amber-950/40 border-b border-amber-800/60 px-4 py-2 text-xs font-medium text-amber-300 flex items-center space-x-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>{resequenceMessage}</span>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-slate-950/40">
            <Swords className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-white">
              No hay combates programados en la cola del Tatami #{tatamiNumber}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Las llaves de las categorías asignadas a este tatami aún no han sido generadas o no tienen combates programados.
            </p>
            {tournamentId && (
              <div className="pt-2">
                <Link
                  href={`/admin/tournaments/${tournamentId}?tab=brackets`}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Ir a Sorteo y Generación de Llaves</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {matches.map((match) => {
              const isNext = match.id === firstScheduledId;
              const isSkipped =
                match.status === 'SCHEDULED' &&
                matches.some(
                  (m) =>
                    m.match_number > match.match_number &&
                    (m.status === 'FINISHED' || m.status === 'ONGOING')
                );

              return (
                <div
                  key={match.id}
                  className={`p-4 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                    isNext
                      ? 'bg-amber-950/25'
                      : isSkipped
                      ? 'bg-amber-950/10 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Número y Categoría */}
                  <div className="flex items-start space-x-4">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 font-mono flex-shrink-0">
                      <span className="text-[10px] text-slate-500 uppercase">Orden</span>
                      <span className="text-base font-black text-white">#{match.match_number}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white block">
                          {match.category_name}
                        </span>
                        {isNext && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Siguiente Combate</span>
                          </span>
                        )}
                        {isSkipped && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>Pendiente / Postergado</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-amber-400 font-medium block">
                        {match.round_name}
                      </span>
                    </div>
                  </div>

                  {/* Competidores (Judogi Blanco vs Judogi Azul) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
                    {/* Blanco */}
                    <div className="flex items-center space-x-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                      <span className="w-3 h-3 rounded-full bg-white shadow-sm flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">
                          {match.white_athlete_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {match.white_club_name}
                        </span>
                      </div>
                    </div>

                    {/* Azul */}
                    <div className="flex items-center space-x-2 bg-slate-950/60 p-2.5 rounded-xl border border-blue-950/80">
                      <span className="w-3 h-3 rounded-full bg-blue-600 shadow-sm flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">
                          {match.blue_athlete_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {match.blue_club_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estado y Botón de Acción "Llamar a Tatami" */}
                  <div className="flex items-center justify-end space-x-3 flex-shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        match.status === 'ONGOING'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : match.status === 'FINISHED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : match.status === 'PENDING'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}
                    >
                      {match.status === 'PENDING' ? 'EN ESPERA' : match.status}
                    </span>

                    {match.status === 'PENDING' ? (
                      <span className="text-[11px] text-slate-500 font-medium italic px-3 py-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                        Esperando Ganador
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCallToTatami(match.id)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Llamar a Tatami</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
