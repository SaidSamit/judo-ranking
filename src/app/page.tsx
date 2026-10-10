// ==============================================================================
// VISTA: PANTALLA PRINCIPAL DE INICIO / LOGIN INSTITUCIONAL
// ==============================================================================
//
// ARQUITECTURA DE AUTO-ENRUTAMIENTO DINÁMICO:
// 1. Acceso de Administración (Director de Torneo / Comisión):
//    - Ingreso clásico con Usuario y Clave.
//    - Enruta directamente al Menú de Campeonatos (/admin/tournaments).
//
// 2. Acceso de Mesa de Tatami (Credencial Única con Auto-Enrutamiento):
//    - Dos campos clásicos: "Identificador de Estación / Usuario" y "Contraseña / PIN".
//    - Sin botones estáticos: El sistema detecta dinámicamente a qué tatami
//      corresponde la credencial y auto-enruta al operador a su tablero (/tatami/[id]).
//
// ==============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Trophy,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Play,
  Sparkles,
  Lock,
} from 'lucide-react';
import { loginAdminAction, loginTatamiAction } from '@/app/actions/auth';

export default function LoginPage() {
  const router = useRouter();

  // Modo de acceso activo: 'ADMIN' | 'TATAMI'
  const [authMode, setAuthMode] = useState<'ADMIN' | 'TATAMI'>('ADMIN');

  // Formulario Admin
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin2026');

  // Formulario Tatami (Credencial Única con Auto-Enrutamiento)
  const [stationIdentifier, setStationIdentifier] = useState('tatami-1');
  const [tatamiPin, setTatamiPin] = useState('1234');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manejador: Login Admin
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set('username', adminUsername);
      formData.set('password', adminPassword);

      const res = await loginAdminAction(formData);
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
      } else {
        setErrorMessage(res.message || 'Credenciales inválidas.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error en autenticación.');
      setLoading(false);
    }
  };

  // Manejador: Login Tatami con Auto-Enrutamiento
  const handleTatamiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await loginTatamiAction(stationIdentifier, tatamiPin);
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
      } else {
        setErrorMessage(res.message || 'Identificador o PIN incorrecto.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con la estación de arbitraje.');
      setLoading(false);
    }
  };

  // Acceso Rápido Demo 1-Click
  const handleQuickAdmin = () => {
    setAuthMode('ADMIN');
    setAdminUsername('admin');
    setAdminPassword('admin2026');
    router.push('/admin/tournaments');
  };

  const handleQuickTatami = (id: string, pin: string) => {
    setAuthMode('TATAMI');
    setStationIdentifier(id);
    setTatamiPin(pin);
    const num = id.replace(/\D/g, '') || '1';
    router.push(`/tatami/${num}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Resplandor decorativo de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* ENCABEZADO INSTITUCIONAL */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider mb-1">
            <span>🥋</span>
            <span>Plataforma Oficial IJF • Judo Ranking</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Acceso al Sistema
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Ingresa como Administrador para gestionar campeonatos o como Mesa de Control para
            arbitrar combates.
          </p>
        </div>

        {/* SELECTOR DE PERFIL (TABS) */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setAuthMode('ADMIN');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
              authMode === 'ADMIN'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Comisión & Director</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('TATAMI');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
              authMode === 'TATAMI'
                ? 'bg-blue-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Mesa de Tatami</span>
          </button>
        </div>

        {/* MENSAJE DE ERROR */}
        {errorMessage && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* FORMULARIO: ADMINISTRACIÓN / DIRECTOR                                */}
        {/* ===================================================================== */}
        {authMode === 'ADMIN' && (
          <form
            onSubmit={handleAdminSubmit}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-1 pb-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Sesión de Administración
              </span>
              <p className="text-xs text-slate-400">
                Accede al <strong>Menú de Campeonatos</strong> para configurar torneos, tatamis e
                inyectar deportistas.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Usuario / Director</label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300">Clave Maestra</label>
                <span className="text-[10px] text-slate-500 font-mono">Demo: admin2026</span>
              </div>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2 mt-2"
            >
              <span>{loading ? 'Ingresando...' : 'Ingresar al Menú de Campeonatos'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ===================================================================== */}
        {/* FORMULARIO: MESA DE TATAMI (CREDENCIAL ÚNICA CON AUTO-ENRUTAMIENTO)  */}
        {/* ===================================================================== */}
        {authMode === 'TATAMI' && (
          <form
            onSubmit={handleTatamiSubmit}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-1 pb-1">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                Sesión de Mesa de Control
              </span>
              <p className="text-xs text-slate-400">
                Ingresa las credenciales impresas en tu ficha. El sistema auto-enrutará
                directamente a la mesa correspondiente.
              </p>
            </div>

            {/* CAMPO 1: IDENTIFICADOR DE ESTACIÓN / USUARIO */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300">
                  Identificador de Estación / Usuario
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Ej: tatami-1</span>
              </div>
              <div className="relative">
                <Monitor className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={stationIdentifier}
                  onChange={(e) => setStationIdentifier(e.target.value)}
                  placeholder="tatami-1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 placeholder-slate-600 font-medium"
                />
              </div>
            </div>

            {/* CAMPO 2: CONTRASEÑA / PIN */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300">Contraseña / PIN</label>
                <span className="text-[10px] text-slate-500 font-mono">Demo: 1234</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={tatamiPin}
                  onChange={(e) => setTatamiPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-base font-mono font-black text-amber-400 tracking-[0.2em] focus:outline-none focus:border-blue-500 placeholder-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2 mt-2"
            >
              <span>{loading ? 'Verificando Estación...' : 'Ingresar a Mesa de Tatami'}</span>
              <Play className="w-4 h-4 fill-current" />
            </button>
          </form>
        )}

        {/* ACCESO RÁPIDO DEMOSTRACIÓN (1 CLIC) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 text-xs text-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Acceso Rápido para Pruebas (1 Clic)
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleQuickAdmin}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold transition flex items-center space-x-1"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Entrar como Director</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickTatami('tatami-1', '1234')}
              className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold transition flex items-center space-x-1"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Tatami 1 (Auto)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickTatami('tatami-2', '1234')}
              className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold transition flex items-center space-x-1"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Tatami 2 (Auto)</span>
            </button>
          </div>
        </div>

        {/* PIE DE PÁGINA */}
        <div className="text-center text-[11px] text-slate-500 space-y-0.5">
          <p>Federación Chilena de Judo • Sistema Certificado IJF</p>
          <p className="font-mono text-[10px]">Auto-Routing Dinámico • Supabase Realtime</p>
        </div>
      </div>
    </main>
  );
}
