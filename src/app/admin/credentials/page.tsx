// ==============================================================================
// VISTA: PANEL DE CREDENCIALES Y GENERADOR DE TORNEO (ADMIN CREDENTIALS)
// ==============================================================================
//
// FLUJO OPERATIVO:
// 1. El Director de Torneo ingresa el viernes por la noche para inicializar el torneo
//    definiendo el nombre y la cantidad de tatamis a operar.
// 2. El sistema genera PINs criptográficos de 6 dígitos y almacena sus hashes bcrypt.
// 3. El Director presiona "Imprimir Fichas Oficiales" (optimizado para @media print con
//    marcas de corte ✂) o copia los códigos rápidamente.
// 4. El sábado por la mañana, se entregan las fichas físicas a los operadores de mesa
//    para iniciar sus sesiones aisladas con Token JWT en /tatami/[id].
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  Printer,
  Copy,
  Check,
  RefreshCw,
  Plus,
  ShieldCheck,
  Monitor,
  Calendar,
  MapPin,
  AlertCircle,
  Sparkles,
  Lock,
  Scissors,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import {
  getTournamentCredentialsAction,
  createTournamentWithTatamisAction,
  regenerateTatamiPinAction,
  TatamiCredential,
  TournamentDetails,
} from '@/app/actions/tournament-builder';

export default function CredentialsPage() {
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [credentials, setCredentials] = useState<TatamiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [regeneratingNumber, setRegeneratingNumber] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );

  // Formulario de creación de torneo
  const [formData, setFormData] = useState({
    name: 'Torneo Zonal de Judo 2026',
    tatami_count: 3,
    location: 'Polideportivo Central',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar credenciales activas
  const loadCredentials = async () => {
    setLoading(true);
    try {
      const res = await getTournamentCredentialsAction();
      if (res.success) {
        setTournament(res.tournament);
        setCredentials(res.credentials);
      }
    } catch (err: any) {
      console.error('Error cargando credenciales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  // Manejador: Copiar PIN individual
  const handleCopyPin = (slug: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  // Manejador: Copiar todas las credenciales
  const handleCopyAll = () => {
    if (!tournament || credentials.length === 0) return;

    let text = `=========================================\n`;
    text += `CREDENCIALES OFICIALES DE TORNEO (PIN)\n`;
    text += `Torneo: ${tournament.name}\n`;
    text += `Sede: ${tournament.location || 'Polideportivo'}\n`;
    text += `Fecha: ${tournament.start_date}\n`;
    text += `=========================================\n\n`;

    credentials.forEach((c) => {
      text += `TATAMI #${c.tatami_number} (${c.station_name})\n`;
      text += `Identificador: ${c.station_slug}\n`;
      text += `PIN Oficial: ${c.pin}\n`;
      text += `URL Mesa: /tatami/${c.tatami_number}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 3000);
  };

  // Manejador: Regenerar PIN individual
  const handleRegeneratePin = async (tatamiNumber: number) => {
    if (
      !confirm(
        `¿Confirmas la regeneración del PIN para el Tatami #${tatamiNumber}? El PIN actual quedará inmediatamente invalidado.`
      )
    ) {
      return;
    }

    setRegeneratingNumber(tatamiNumber);
    try {
      const res = await regenerateTatamiPinAction(tatamiNumber);
      if (res.success && res.newPin) {
        setCredentials((prev) =>
          prev.map((c) => (c.tatami_number === tatamiNumber ? { ...c, pin: res.newPin! } : c))
        );
        setFeedback({
          type: 'success',
          text: `PIN del Tatami #${tatamiNumber} actualizado a ${res.newPin}. Imprime o anota el nuevo código.`,
        });
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error al regenerar PIN.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error inesperado al regenerar PIN.' });
    } finally {
      setRegeneratingNumber(null);
    }
  };

  // Manejador: Crear / Configurar Nuevo Torneo
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createTournamentWithTatamisAction({
        name: formData.name.trim(),
        tatami_count: Number(formData.tatami_count),
        location: formData.location.trim(),
      });

      if (res.success && res.tournament) {
        setTournament(res.tournament);
        setCredentials(res.credentials);
        setIsModalOpen(false);
        setFeedback({
          type: 'success',
          text: `¡Torneo "${res.tournament.name}" aprovisionado! Se generaron ${res.credentials.length} credenciales seguras.`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'No fue posible aprovisionar el torneo.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error procesando la solicitud.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador: Imprimir hoja oficial
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* ========================================================================= */}
      {/* VISTA PARA IMPRESIÓN (SOLO VISIBLE AL IMPRIMIR CON WINDOW.PRINT)         */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black font-sans bg-white p-4">
        <div className="border-b-2 border-black pb-4 mb-6 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wider">
            Federación / Asociación de Judo
          </h1>
          <h2 className="text-xl font-bold mt-1 text-slate-800">
            Credenciales Oficiales de Acceso • Estaciones de Mesa de Control
          </h2>
          <div className="flex justify-center items-center gap-6 text-xs text-slate-600 mt-2 font-mono">
            <span>Torneo: <strong>{tournament?.name || 'Campeonato Oficial'}</strong></span>
            <span>Sede: <strong>{tournament?.location || 'Gimnasio Principal'}</strong></span>
            <span>Fecha: <strong>{tournament?.start_date || new Date().toLocaleDateString('es-CL')}</strong></span>
          </div>
        </div>

        <div className="mb-4 text-xs text-slate-700 italic text-center">
          Instrucciones para Comisarios: Recorte cada ficha por la línea de puntos y entréguela al operador de la mesa correspondiente antes de la ceremonia de apertura.
        </div>

        {/* Fichas recortables */}
        <div className="grid grid-cols-2 gap-6">
          {credentials.map((cred) => (
            <div
              key={cred.station_slug}
              className="border-2 border-dashed border-black rounded-lg p-5 flex flex-col justify-between h-72 page-break-inside-avoid relative"
            >
              <div className="flex items-center justify-between border-b border-black pb-2">
                <span className="text-lg font-black tracking-wider uppercase">
                  TATAMI #{cred.tatami_number}
                </span>
                <span className="text-xs font-mono uppercase bg-black text-white px-2 py-0.5 rounded font-bold">
                  {cred.station_slug}
                </span>
              </div>

              <div className="text-center my-auto py-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600 block mb-1">
                  PIN DE ACCESO AUTORIZADO
                </span>
                <div className="text-4xl font-mono font-black tracking-[0.3em] bg-slate-100 py-3 rounded border border-slate-300">
                  {cred.pin}
                </div>
              </div>

              <div className="text-[10px] text-slate-700 space-y-0.5 border-t border-slate-300 pt-2 font-sans">
                <p>1. Ingresar en el navegador a la pantalla de inicio <strong>/</strong> (Mesa de Tatami).</p>
                <p>2. Identificador / Usuario: <strong>{cred.station_slug}</strong></p>
                <p>3. Contraseña / PIN: <strong>{cred.pin}</strong> (El sistema auto-enruta al tablero).</p>
              </div>

              <div className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-mono text-slate-500">
                ✂ Cortar ficha
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-black flex justify-between items-center text-xs text-slate-600 font-mono">
          <div>Documento emitido: {new Date().toLocaleString('es-CL')}</div>
          <div className="border-t border-black w-48 text-center pt-1">
            Firma Director de Torneo
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA WEB PROFESIONAL (PANTALLA)                                          */}
      {/* ========================================================================= */}
      <div className="print:hidden space-y-6">
        {/* CABECERA */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-7 h-7 text-amber-400" />
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Aprovisionamiento & Credenciales de Tatami
              </h1>
            </div>
            <p className="text-slate-400 text-sm max-w-3xl">
              Genera los PINs de seguridad para las mesas de control. Cada estación opera en una
              sesión aislada con token JWT firmado de 7 días. Imprime o copia las credenciales el
              día del campeonato para distribuirlas a los operadores.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={credentials.length === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-2 shadow-sm"
              title="Imprimir hoja oficial con marcas de corte"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Imprimir Fichas (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 shadow-lg"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Inicializar Torneo</span>
            </button>
          </div>
        </header>

        {/* FEEDBACK NOTIFICACIÓN */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-red-950/60 border-red-500 text-red-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white text-xs px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* RESUMEN DEL TORNEO ACTIVO */}
        {tournament && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Torneo Activo
                </span>
                <span className="text-sm font-black text-white truncate block">
                  {tournament.name}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <Monitor className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tatamis Aprovisionados
                </span>
                <span className="text-base font-black text-white block">
                  {credentials.length} Estaciones Físicas
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Seguridad & Cifrado
                </span>
                <span className="text-xs font-bold text-emerald-400 block">
                  PIN 6 Dígitos • Bcrypt + JWT
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sede Oficial
                </span>
                <span className="text-xs font-bold text-slate-200 truncate block">
                  {tournament.location || 'Polideportivo Central'}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* BARRA DE HERRAMIENTAS Y ACCIONES RÁPIDAS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="font-mono text-amber-400 font-bold">● {credentials.length}</span>
            <span>Credenciales disponibles para entrega el día del evento</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={credentials.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Todos los PINs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={loadCredentials}
              disabled={loading}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
              title="Refrescar estado de tatamis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* TARJETAS DE CREDENCIALES POR TATAMI */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {credentials.map((cred) => (
            <div
              key={cred.station_slug}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl transition-all relative overflow-hidden group"
            >
              {/* Resplandor decorativo */}
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

              {/* Encabezado de la tarjeta */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-black text-white tracking-wide">
                      TATAMI #{cred.tatami_number}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      {cred.station_slug}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5 block">{cred.station_name}</span>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                  ACTIVO
                </span>
              </div>

              {/* PIN CENTRAL DESTACADO */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 text-center space-y-1 relative">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  PIN DE ACCESO (6 DÍGITOS)
                </span>
                <div className="font-mono text-3xl font-black tracking-[0.25em] text-amber-400 flex items-center justify-center select-all">
                  {cred.pin}
                </div>
              </div>

              {/* ACCIONES Y ENLACES DIRECTOS */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleCopyPin(cred.station_slug, cred.pin)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition flex items-center space-x-1"
                    title="Copiar PIN"
                  >
                    {copiedSlug === cred.station_slug ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px]">Copiar PIN</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegeneratePin(cred.tatami_number)}
                    disabled={regeneratingNumber === cred.tatami_number}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/80 text-slate-400 hover:text-red-400 border border-slate-700/60 transition"
                    title="Regenerar PIN en caso de fuga"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        regeneratingNumber === cred.tatami_number ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center space-x-1.5">
                  <Link
                    href={`/tatami/${cred.tatami_number}`}
                    target="_blank"
                    className="px-2.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 text-blue-300 font-bold text-[11px] border border-blue-800/60 transition"
                    title="Abrir mesa de control"
                  >
                    Mesa
                  </Link>

                  <Link
                    href={`/scoreboard/${cred.tatami_number}`}
                    target="_blank"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] border border-slate-700 transition inline-flex items-center space-x-1"
                    title="Abrir TV scoreboard"
                  >
                    <Tv className="w-3 h-3 text-amber-400" />
                    <span>TV</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: INICIALIZAR TORNEO & RE-APROVISIONAR TATAMIS                       */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">Inicializar Torneo & PINs</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Nombre del Torneo Oficial</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Copa Apertura Iquique 2026"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Cantidad de Tatamis en Operación
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData({ ...formData, tatami_count: num })}
                      className={`py-2 rounded-xl text-xs font-black transition border ${
                        formData.tatami_count === num
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {num} {num === 1 ? 'Tatami' : 'Tatamis'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Lugar / Sede del Evento</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ej: Polideportivo Municipal"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 space-y-1">
                <span className="font-bold block">Aviso de Sobrescritura de Seguridad:</span>
                <p className="text-slate-300">
                  Al confirmar, se generarán nuevos PINs seguros de 6 dígitos para los {formData.tatami_count} tatamis seleccionados y se sincronizarán con la base de datos Supabase.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Generar Torneo & PINs</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
