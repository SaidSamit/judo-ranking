// ==============================================================================
// VISTA: MENÚ DE CAMPEONATOS & INYECCIÓN DE DEPORTISTAS
// ==============================================================================
//
// REGLAS Y FUNCIONES:
// 1. Listado de campeonatos creados en el sistema con su estado y estadísticas.
// 2. Creación de nuevos torneos definiendo fechas, sede y cantidad de tatamis.
// 3. Inyección directa de atletas: Al crear o seleccionar un campeonato, se
//    asocian y registran los deportistas en las categorías correspondientes.
// 4. Conmutación reactiva de torneo oficial activo.
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Plus,
  Users,
  Calendar,
  MapPin,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Play,
  Scale,
  KeyRound,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getTournamentsAction,
  createTournamentAction,
  injectAthletesToTournamentAction,
  setActiveTournamentAction,
  TournamentItem,
} from '@/app/actions/tournaments';
import { BASE_ATHLETES_ROSTER } from '@/lib/data/roster-data';

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [targetTournament, setTargetTournament] = useState<TournamentItem | null>(null);

  // Estados del formulario de creación
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('Polideportivo Central');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTatamiCount, setFormTatamiCount] = useState(3);
  const [formInjectAthletes, setFormInjectAthletes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Cargar lista de campeonatos
  const loadTournaments = async () => {
    setLoading(true);
    try {
      const res = await getTournamentsAction();
      if (res.success) {
        setTournaments(res.tournaments);
        setActiveTournamentId(res.activeTournamentId);
      }
    } catch (err: any) {
      console.error('Error cargando campeonatos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // Manejador: Crear Campeonato
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createTournamentAction({
        name: formName.trim(),
        location: formLocation.trim(),
        start_date: formStartDate,
        end_date: formEndDate,
        tatami_count: Number(formTatamiCount),
        injectExistingAthletes: formInjectAthletes,
      });

      if (res.success && res.tournament) {
        setTournaments((prev) => [res.tournament!, ...prev.map((t) => ({ ...t, is_active: false }))]);
        setActiveTournamentId(res.tournament.id);
        setIsCreateModalOpen(false);
        setFormName('');
        setFeedback({
          type: 'success',
          text: `${res.message} Entrando al panel del campeonato...`,
        });
        router.push(`/admin/tournaments/${res.tournament.id}`);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'No fue posible crear el campeonato.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error inesperado.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejador: Inyectar deportistas a un campeonato existente
  const handleInjectAthletes = async () => {
    if (!targetTournament) return;

    setIsSubmitting(true);
    try {
      const res = await injectAthletesToTournamentAction(targetTournament.id);
      if (res.success) {
        setTournaments((prev) =>
          prev.map((t) =>
            t.id === targetTournament.id
              ? {
                  ...t,
                  athlete_count: (t.athlete_count || 0) + res.count,
                  categories_count: Math.max(t.categories_count || 1, 4),
                }
              : t
          )
        );
        setIsInjectModalOpen(false);
        setFeedback({
          type: 'success',
          text: `¡Se inyectaron ${res.count} deportistas a ${targetTournament.name}! Listos para pesaje y llaves.`,
        });
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error inyectando deportistas.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error inesperado al inyectar.' });
    } finally {
      setIsSubmitting(false);
      setTargetTournament(null);
    }
  };

  // Manejador: Activar campeonato
  const handleSetActive = async (tour: TournamentItem) => {
    try {
      await setActiveTournamentAction(tour.id);
      setTournaments((prev) =>
        prev.map((t) => ({ ...t, is_active: t.id === tour.id, status: t.id === tour.id ? 'ACTIVE' : 'DRAFT' }))
      );
      setActiveTournamentId(tour.id);
      setFeedback({
        type: 'info',
        text: `Campeonato "${tour.name}" establecido como el torneo activo en ejecución.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error activando campeonato.' });
    }
  };

  const activeTour = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* CABECERA */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Trophy className="w-7 h-7 text-amber-400" />
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Gestión de Campeonatos Oficiales
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-3xl">
            Crea nuevos campeonatos, asigna la cantidad de tatamis y administra la inyección de
            los deportistas ingresados a sus respectivas divisiones y categorías oficiales IJF.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 shadow-lg flex-shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Crear Nuevo Campeonato</span>
        </button>
      </header>

      {/* MENSAJES DE ESTADO */}
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
              <AlertCircle className="w-4 h-4 text-amber-400" />
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

      {/* RESUMEN DE CONTROL GLOBAL */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Campeonato Activo
          </span>
          <span className="text-base font-black text-amber-400 truncate block mt-1">
            {activeTour?.name || 'Ninguno'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Tatamis en Operación
          </span>
          <span className="text-2xl font-black text-white mt-1 block">
            {activeTour?.tatami_count || 0}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
            Deportistas Inyectados
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {activeTour?.athlete_count || 0}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Campeonatos
          </span>
          <span className="text-2xl font-black text-white mt-1 block">
            {tournaments.length}
          </span>
        </div>
      </section>

      {/* LISTADO DE CAMPEONATOS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Campeonatos Registrados ({tournaments.length})
          </h2>

          <button
            type="button"
            onClick={loadTournaments}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tournaments.map((tour) => (
            <div
              key={tour.id}
              className={`bg-slate-900/90 border rounded-2xl p-6 space-y-5 transition shadow-xl relative overflow-hidden ${
                tour.is_active
                  ? 'border-amber-500/80 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Encabezado del campeonato */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white">{tour.name}</h3>
                    {tour.is_active && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                        ACTIVO
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{tour.location}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>{tour.start_date}</span>
                    </span>
                  </div>
                </div>

                {!tour.is_active && (
                  <button
                    type="button"
                    onClick={() => handleSetActive(tour)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition"
                  >
                    Activar
                  </button>
                )}
              </div>

              {/* Estadísticas de tatamis y deportistas */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Tatamis</span>
                  <span className="text-base font-black text-white">{tour.tatami_count}</span>
                </div>
                <div className="border-x border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Deportistas</span>
                  <span className="text-base font-black text-emerald-400">{tour.athlete_count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Categorías</span>
                  <span className="text-base font-black text-blue-400">{tour.categories_count}</span>
                </div>
              </div>

              {/* Botón Maestro: Acceso Directo al Dashboard Aislado */}
              <div className="pt-2 border-t border-slate-800/80">
                <Link
                  href={`/admin/tournaments/${tour.id}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center justify-center space-x-2 shadow-md group"
                >
                  <span>Gestionar Campeonato</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL: CREAR NUEVO CAMPEONATO                                            */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">Nuevo Campeonato Oficial</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Nombre del Campeonato</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Campeonato Nacional Clausura 2026"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Fecha de Fin</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Sede / Gimnasio</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Ej: Polideportivo Municipal Iquique"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
              </div>

              {/* Selector de tatamis */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Tatamis Oficiales en Operación</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormTatamiCount(num)}
                      className={`py-2 rounded-xl text-xs font-black transition border ${
                        formTatamiCount === num
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {num} {num === 1 ? 'Tatami' : 'Tatamis'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inyección de atletas checkbox */}
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="injectAthletesCheck"
                  checked={formInjectAthletes}
                  onChange={(e) => setFormInjectAthletes(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="injectAthletesCheck" className="text-xs text-slate-300 cursor-pointer">
                  <strong className="text-emerald-300 block">
                    Inyectar automáticamente deportistas ingresados ({BASE_ATHLETES_ROSTER.length} atletas)
                  </strong>
                  Asocia de inmediato la nómina de atletas ingresados al campeonato, creando sus divisiones oficiales para pesaje y llaves.
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4" />
                      <span>Crear Campeonato</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INYECCIÓN MANUAL DE DEPORTISTAS                                   */}
      {/* ========================================================================= */}
      {isInjectModalOpen && targetTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Inyectar Deportistas</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInjectModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Estás a punto de inyectar la nómina de atletas registrados en el campeonato:
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-amber-300">
                {targetTournament.name}
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="font-bold text-slate-400 block">Deportistas a Inyectar:</span>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {BASE_ATHLETES_ROSTER.map((ath, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-1 border-b border-slate-800 text-[11px]"
                    >
                      <span className="font-bold text-white">{ath.name}</span>
                      <span className="text-slate-400">{ath.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsInjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleInjectAthletes}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center space-x-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inyectando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Confirmar Inyección</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
