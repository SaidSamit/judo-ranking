// ==============================================================================
// VISTA: PANTALLA PRINCIPAL DE INICIO / SMART LOGIN UNIFICADO
// ==============================================================================
//
// ARQUITECTURA DE AUTO-ENRUTAMIENTO DINÁMICO:
// - Un solo formulario limpio para administradores y operadores de estación.
// - Administradores: Usan su correo electrónico (ej: saidsamitmiranda@judoranking.cl) y clave.
// - Estaciones: Usan su slug (ej: tatami-1, pesaje-varones, pesaje-damas) y su PIN.
// - Modo Demo: Identificador "demo" y PIN "1234" enruta a /tatami/demo.
// - Backend: Realiza Database Fallback automático en /api/auth/login.
//
// ==============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  ArrowRight,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // Formulario Unificado
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manejador: Envío unificado al endpoint /api/auth/login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, secret }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.redirectTo) {
        router.push(data.redirectTo);
      } else {
        setErrorMessage(
          data.error || 'Credenciales inválidas. Verifica tu identificador o contraseña.'
        );
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con el servidor de autenticación.');
      setLoading(false);
    }
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
            <span>Judo Ranking • Plataforma de Competición</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Acceso al Sistema
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Ingresa con tu correo de administración o con el identificador de tu estación (mesa o pesaje).
          </p>
        </div>

        {/* MENSAJE DE ERROR */}
        {errorMessage && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-xs flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ===================================================================== */}
        {/* FORMULARIO ÚNICO: SMART LOGIN                                        */}
        {/* ===================================================================== */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl backdrop-blur-md"
        >
          {/* CAMPO 1: IDENTIFICADOR DE ESTACIÓN O CORREO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Identificador de Estación o Correo</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ej. tatami-1, pesaje-varones o director@judo.cl"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-amber-400 placeholder-slate-500"
            />
          </div>

          {/* CAMPO 2: PIN O CONTRASEÑA */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>PIN o Contraseña</span>
            </label>
            <input
              type="password"
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400 placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2 mt-4"
          >
            <span>{loading ? 'Verificando...' : 'Ingresar al Sistema'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* PIE DE PÁGINA */}
        <div className="text-center text-xs text-slate-500">
          <p className="font-mono text-slate-400 font-semibold tracking-wide">
            Versión Beta 0.1.0
          </p>
        </div>
      </div>
    </main>
  );
}
