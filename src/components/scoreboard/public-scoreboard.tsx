// ==============================================================================
// COMPONENTE: MARCADOR PÚBLICO (TV DISPLAY - REGLAS IJF)
// ==============================================================================
//
// CARACTERÍSTICAS TÉCNICAS:
// 1. Modo Receptor de Supabase Realtime: Escucha en milisegundos las emisiones
//    de la mesa de control sin realizar consultas repetitivas a la base de datos.
// 2. Tipografía de Gran Escala: Diseñado para ser legible a más de 20 metros en
//    pantallas de 55" a 75" en el gimnasio.
// 3. Interfaz de Solo Lectura: No admite clics ni atajos que alteren los datos.
// 4. Modo Pantalla Completa: Botón accesible para maximizar en televisores.
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeBroadcast } from '@/hooks/use-realtime-broadcast';
import { BroadcastMatchPayload } from '@/types/events';

interface PublicScoreboardProps {
  initialPayload: BroadcastMatchPayload;
  channelName: string;
}

export function PublicScoreboard({ initialPayload, channelName }: PublicScoreboardProps) {
  const [matchData, setMatchData] = useState<BroadcastMatchPayload>(initialPayload);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 1. Suscripción en MODO RECEPTOR al canal de Broadcast de Supabase
  const { connectionStatus, isSubscribed } = useRealtimeBroadcast({
    channelName,
    mode: 'RECEIVER',
    onStateReceived: (payload) => {
      setMatchData(payload);
    },
  });

  // 2. Formato mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(Math.abs(totalSeconds) / 60);
    const secs = Math.abs(totalSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 3. Manejo de Pantalla Completa (Fullscreen)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error al entrar en pantalla completa:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error al salir de pantalla completa:', err);
      });
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const { projection } = matchData;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white font-sans select-none overflow-hidden relative">
      {/* ==================================================================== */}
      {/* BARRA SUPERIOR: TATAMI, CATEGORÍA Y ESTADO DE CONEXIÓN */}
      {/* ==================================================================== */}
      <header className="flex items-center justify-between px-8 py-3 bg-slate-900 border-b-2 border-slate-800">
        <div className="flex items-center space-x-6">
          <span className="text-3xl font-black tracking-widest text-amber-400">
            TATAMI {matchData.tatami_number}
          </span>
          <span className="text-xl font-bold px-4 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
            {matchData.category_name} • Combate #{matchData.match_number}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {matchData.is_golden_score && (
            <span className="text-lg font-black px-4 py-1 rounded-md bg-amber-500 text-slate-950 animate-pulse tracking-wider">
              GOLDEN SCORE
            </span>
          )}

          {/* Indicador de conexión Realtime */}
          <div className="flex items-center space-x-2 text-sm text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
            <span
              className={`w-3 h-3 rounded-full ${
                isSubscribed
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="font-mono text-xs uppercase">{connectionStatus}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition"
            title="Pantalla Completa"
          >
            {isFullscreen ? '⤢ Salir' : '⤢ TV Fullscreen'}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* CUERPO PRINCIPAL DEL MARCADOR: BLANCO vs RELOJ vs AZUL */}
      {/* ==================================================================== */}
      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* ================================================================== */}
        {/* LADO IZQUIERDO: ATLETA BLANCO (SHIRO) */}
        {/* ================================================================== */}
        <section className="col-span-5 bg-white text-slate-950 p-8 flex flex-col justify-between border-r-4 border-slate-950">
          <div>
            <span className="text-sm font-black tracking-widest text-slate-500 uppercase block">
              BLANCO (SHIRO)
            </span>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-950 mt-1 truncate">
              {matchData.white_athlete_name}
            </h1>
            <p className="text-2xl font-bold text-slate-600 truncate mt-1">
              {matchData.white_club_name}
            </p>
          </div>

          {/* Cajas de Puntuación Gigantes */}
          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-2xl border-2 border-slate-300 shadow-sm">
              <span className="text-lg font-black text-slate-500 tracking-wider">IPPON</span>
              <span className="text-8xl lg:text-9xl font-black text-slate-950">
                {projection.white_score.ippon}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-2xl border-2 border-slate-300 shadow-sm">
              <span className="text-lg font-black text-slate-500 tracking-wider">WAZA-ARI</span>
              <span className="text-8xl lg:text-9xl font-black text-blue-700">
                {projection.white_score.wazaari}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-2xl border-2 border-slate-300 shadow-sm">
              <span className="text-lg font-black text-slate-500 tracking-wider">YUKO</span>
              <span className="text-8xl lg:text-9xl font-black text-amber-600">
                {projection.white_score.yuko}
              </span>
            </div>
          </div>

          {/* Tarjetas Visuales de Shido / Hansoku-make */}
          <div className="flex items-center justify-between p-4 bg-slate-100 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-4">
              <span className="text-xl font-black text-slate-700 tracking-wider">SHIDO:</span>
              <div className="flex space-x-2">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className={`w-7 h-11 rounded-md border-2 transition-all ${
                      projection.white_score.shido >= num
                        ? 'bg-amber-400 border-amber-500 shadow-md scale-105'
                        : 'bg-white border-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {projection.white_score.has_hansoku_make && (
              <span className="text-xl font-black px-4 py-1 rounded-lg bg-red-600 text-white uppercase tracking-wider animate-pulse">
                HANSOKU-MAKE
              </span>
            )}
          </div>
        </section>

        {/* ================================================================== */}
        {/* CENTRO: CRONÓMETRO PRINCIPAL Y MEDIDOR DE OSAEKOMI */}
        {/* ================================================================== */}
        <section className="col-span-2 bg-slate-950 p-4 flex flex-col justify-between items-center border-r-4 border-slate-950">
          {/* Cronómetro Principal */}
          <div className="w-full text-center space-y-2 pt-4">
            <span className="text-sm uppercase font-mono tracking-widest text-slate-400 font-bold">
              TIEMPO
            </span>
            <div
              className={`text-7xl lg:text-8xl font-black font-mono tracking-tighter ${
                matchData.match_time_remaining === 0
                  ? 'text-red-500 animate-pulse'
                  : matchData.is_clock_running
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {formatTime(matchData.match_time_remaining)}
            </div>
          </div>

          {/* Medidor de Osaekomi */}
          <div className="w-full p-4 rounded-2xl bg-slate-900 border-2 border-slate-800 text-center space-y-2">
            <span className="text-base font-bold uppercase tracking-widest text-slate-400">
              OSAEKOMI
            </span>
            <div
              className={`text-6xl font-black font-mono ${
                matchData.active_osaekomi
                  ? 'text-amber-400 scale-110 animate-bounce'
                  : 'text-slate-600'
              }`}
            >
              {String(matchData.osaekomi_seconds).padStart(2, '0')}&quot;
            </div>
            {matchData.active_osaekomi && (
              <span
                className={`inline-block text-sm font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                  matchData.active_osaekomi === 'WHITE'
                    ? 'bg-white text-slate-950'
                    : 'bg-blue-600 text-white'
                }`}
              >
                RETENIENDO: {matchData.active_osaekomi}
              </span>
            )}
          </div>

          {/* Aviso de Victoria Matemática */}
          {projection.is_mathematical_victory && (
            <div className="w-full p-4 rounded-xl bg-emerald-950 border-2 border-emerald-500 text-center space-y-1 animate-pulse">
              <span className="text-xl font-black text-emerald-400 tracking-wider block">
                VICTORIA {projection.winner}
              </span>
              <span className="text-xs text-emerald-300 font-bold block truncate">
                {projection.win_reason}
              </span>
            </div>
          )}

          <div className="pb-2 text-center text-xs text-slate-600 font-mono">
            Circuito Federado • Reglas Oficiales
          </div>
        </section>

        {/* ================================================================== */}
        {/* LADO DERECHO: ATLETA AZUL (AO) */}
        {/* ================================================================== */}
        <section className="col-span-5 bg-blue-700 text-white p-8 flex flex-col justify-between">
          <div>
            <span className="text-sm font-black tracking-widest text-blue-200 uppercase block">
              AZUL (AO)
            </span>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-white mt-1 truncate">
              {matchData.blue_athlete_name}
            </h1>
            <p className="text-2xl font-bold text-blue-200 truncate mt-1">
              {matchData.blue_club_name}
            </p>
          </div>

          {/* Cajas de Puntuación Gigantes */}
          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="flex flex-col items-center justify-center p-6 bg-blue-800/80 rounded-2xl border-2 border-blue-500 shadow-sm">
              <span className="text-lg font-black text-blue-200 tracking-wider">IPPON</span>
              <span className="text-8xl lg:text-9xl font-black text-white">
                {projection.blue_score.ippon}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-blue-800/80 rounded-2xl border-2 border-blue-500 shadow-sm">
              <span className="text-lg font-black text-blue-200 tracking-wider">WAZA-ARI</span>
              <span className="text-8xl lg:text-9xl font-black text-white">
                {projection.blue_score.wazaari}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-blue-800/80 rounded-2xl border-2 border-blue-500 shadow-sm">
              <span className="text-lg font-black text-blue-200 tracking-wider">YUKO</span>
              <span className="text-8xl lg:text-9xl font-black text-white">
                {projection.blue_score.yuko}
              </span>
            </div>
          </div>

          {/* Tarjetas Visuales de Shido / Hansoku-make */}
          <div className="flex items-center justify-between p-4 bg-blue-900/60 rounded-2xl border border-blue-600">
            <div className="flex items-center space-x-4">
              <span className="text-xl font-black text-blue-200 tracking-wider">SHIDO:</span>
              <div className="flex space-x-2">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className={`w-7 h-11 rounded-md border-2 transition-all ${
                      projection.blue_score.shido >= num
                        ? 'bg-amber-400 border-amber-300 shadow-md scale-105'
                        : 'bg-blue-950 border-blue-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {projection.blue_score.has_hansoku_make && (
              <span className="text-xl font-black px-4 py-1 rounded-lg bg-red-600 text-white uppercase tracking-wider animate-pulse">
                HANSOKU-MAKE
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
