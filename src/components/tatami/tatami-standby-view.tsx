// ==============================================================================
// COMPONENTE: PANTALLA DE ESPERA DE MESA DE TATAMI (STANDBY VIEW)
// ==============================================================================
//
// OBJETIVO:
// Reemplaza el combate inventado / simulado cuando un operador inicializa su
// sesión de tatami antes de que el Director de Torneo haya generado o asignado
// cruces a ese tatami específico.
//
// CARACTERÍSTICAS:
// 1. Sondeo reactivo cada 5 segundos: en cuanto el Director genera la llave,
//    la mesa detecta automáticamente el combate y se activa a 0ms sin intervención.
// 2. Información en vivo de conexión: muestra número de tatami, hora y estado.
// 3. Botón de verificación inmediata y botón de cierre de sesión seguro.
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Swords,
  RefreshCw,
  LogOut,
  Radio,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { getTatamiQueueMatchesAction } from '@/app/actions/brackets';

interface TatamiStandbyViewProps {
  tatamiNumber: number;
  tournamentName?: string;
}

export function TatamiStandbyView({
  tatamiNumber,
  tournamentName = 'Campeonato Oficial de Judo',
}: TatamiStandbyViewProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [lastCheckTime, setLastCheckTime] = useState<string>('Recién conectado');

  // Reloj en vivo
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Función para comprobar si ingresaron nuevos combates a la cola
  const checkForMatches = async () => {
    setChecking(true);
    try {
      const res = await getTatamiQueueMatchesAction(tatamiNumber);
      setLastCheckTime(new Date().toLocaleTimeString('es-CL'));
      if (res.success && res.matches && res.matches.length > 0) {
        // Encontró combate: recargar para entrar de inmediato a la mesa de arbitraje
        window.location.reload();
      }
    } catch (err) {
      console.warn('[Standby] Error verificando combates:', err);
    } finally {
      setChecking(false);
    }
  };

  // Sondeo automático cada 6 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      checkForMatches();
    }, 6000);
    return () => clearInterval(interval);
  }, [tatamiNumber]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* BARRA SUPERIOR DE TELEMETRÍA */}
      <header className="flex items-center justify-between border-b border-slate-900 pb-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black">
            T{tatamiNumber}
          </div>
          <div>
            <div className="text-xs font-mono text-amber-400 uppercase tracking-widest font-bold">
              Estación de Mesa Conectada
            </div>
            <div className="text-sm font-black text-white">{tournamentName}</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentTime}</span>
          </div>

          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition text-xs font-bold"
            title="Cambiar de estación o salir"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </Link>
        </div>
      </header>

      {/* ÁREA CENTRAL DE ESPERA */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
          {/* Brillo decorativo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Icono con animación sutil de pulso */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Swords className="w-10 h-10 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TATAMI #{tatamiNumber} EN VÍSPERA DE COMBATES</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mesa de Control en Espera
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Esta mesa está vinculada y lista para recibir el cronograma de combates.
              En cuanto el Director de Torneo sortee las llaves o active la cola para este Tatami,
              el primer cruce se cargará automáticamente en pantalla.
            </p>
          </div>

          {/* Panel de estado de sondeo */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Sondeo en tiempo real</span>
            </div>
            <span className="text-slate-500">{lastCheckTime}</span>
          </div>

          {/* Acciones */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={checkForMatches}
              disabled={checking}
              className="flex-1 inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Comprobando...' : 'Verificar Ahora'}</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Cambiar Mesa</span>
            </Link>
          </div>
        </div>
      </main>

      {/* PIE DE PÁGINA */}
      <footer className="text-center text-slate-600 text-[11px] font-mono border-t border-slate-900 pt-4">
        Sistema Oficial B2B de Gestión de Torneos de Judo • Federación y Reglas IJF
      </footer>
    </div>
  );
}
