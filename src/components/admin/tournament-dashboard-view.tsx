// ==============================================================================
// COMPONENTE: PANEL INTEGRADO Y DASHBOARD DE TORNEO (DASHBOARD AISLADO)
// ==============================================================================
//
// REGLAS DE NEGOCIO (AISLAMIENTO DE CAMPEONATOS):
// 1. Patrón Maestro-Detalle: Todo lo que ocurre en este dashboard pertenece
//    estrictamente al tournamentId seleccionado (inscripciones, pesaje, llaves, PINs).
// 2. Cero Fuga de Datos: No se mezclan atletas ni categorías de un torneo con otro.
// 3. Flujo Oficial IJF:
//    - Pestaña 1 (Nómina & Inscripciones): Acreditación y carga de nómina.
//    - Pestaña 2 (Estación de Pesaje): Captura de peso real y reclasificación.
//    - Pestaña 3 (Llaves & Sorteo): Generación y visualización del árbol / Berger.
//    - Pestaña 4 (Tatamis & Credenciales): PINs de acceso para mesas y fichas de impresión.
//
// ==============================================================================

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Scale,
  Swords,
  KeyRound,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Search,
  RotateCcw,
  Lock,
  Unlock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  Scissors,
  Tv,
  Monitor,
  PlayCircle,
} from 'lucide-react';
import { TournamentItem, setActiveTournamentAction, injectAthletesToTournamentAction } from '@/app/actions/tournaments';
import {
  getTournamentRegistrationsAction,
  RegisteredAthleteSummary,
} from '@/app/actions/registrations';
import {
  getWeighInAthletesAction,
  recordAthleteWeightAction,
  WeighInAthlete,
} from '@/app/actions/weigh-in';
import {
  getTournamentCategoriesStatusAction,
  generateCategoryMatchesAction,
  saveModifiedBracketAction,
  getCategoryBracketAction,
  CategoryBracketStatus,
} from '@/app/actions/brackets';
import {
  getTournamentCredentialsAction,
  TatamiCredential,
} from '@/app/actions/tournament-builder';
import { BracketViewer } from '@/components/admin/bracket-viewer';
import { RosterUpload } from '@/components/admin/roster-upload';
import { BracketResult } from '@/lib/rules/bracket-engine';
import {
  isWeightValidForCategory,
  getSuggestedUpperCategory,
  parseWeightLimitFromCategory,
} from '@/lib/rules/judo-categories';

type DashboardTab = 'roster' | 'weigh_in' | 'brackets' | 'credentials';

interface TournamentDashboardViewProps {
  initialTournament: TournamentItem;
}

export function TournamentDashboardView({ initialTournament }: TournamentDashboardViewProps) {
  const [tournament, setTournament] = useState<TournamentItem>(initialTournament);
  const [activeTab, setActiveTab] = useState<DashboardTab>('roster');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // ==========================================================================
  // ESTADOS DE PESTAÑA 1: NÓMINA & INSCRIPCIONES
  // ==========================================================================
  const [registeredAthletes, setRegisteredAthletes] = useState<RegisteredAthleteSummary[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // ==========================================================================
  // ESTADOS DE PESTAÑA 2: PESAJE
  // ==========================================================================
  const [weighInAthletes, setWeighInAthletes] = useState<WeighInAthlete[]>([]);
  const [loadingWeighIn, setLoadingWeighIn] = useState(false);
  const [weighInSearch, setWeighInSearch] = useState('');
  const [weighInCategoryFilter, setWeighInCategoryFilter] = useState('ALL');
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<string | null>(null);

  // ==========================================================================
  // ESTADOS DE PESTAÑA 3: LLAVES & SORTEO
  // ==========================================================================
  const [categories, setCategories] = useState<CategoryBracketStatus[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryBrackets, setCategoryBrackets] = useState<Record<string, BracketResult>>({});
  const [loadingBrackets, setLoadingBrackets] = useState(false);
  const [isGeneratingBrackets, setIsGeneratingBrackets] = useState(false);

  // ==========================================================================
  // ESTADOS DE PESTAÑA 4: CREDENCIALES PIN
  // ==========================================================================
  const [credentials, setCredentials] = useState<TatamiCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ==========================================================================
  // CARGA DE DATOS AISLADOS POR TORNEO
  // ==========================================================================

  // 1. Cargar nómina confirmada de este torneo
  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const res = await getTournamentRegistrationsAction(tournament.id);
      if (res.success) {
        setRegisteredAthletes(res.athletes);
        setTournament((prev) => ({
          ...prev,
          athlete_count: res.athletes.length,
        }));
      }
    } catch (err: any) {
      console.error('Error cargando nómina del torneo:', err);
    } finally {
      setLoadingRoster(false);
    }
  }, [tournament.id]);

  // 2. Cargar atletas para pesaje de este torneo
  const loadWeighIn = useCallback(async () => {
    setLoadingWeighIn(true);
    try {
      const res = await getWeighInAthletesAction(tournament.id);
      if (res.success) {
        setWeighInAthletes(res.athletes);
      }
    } catch (err: any) {
      console.error('Error cargando pesaje del torneo:', err);
    } finally {
      setLoadingWeighIn(false);
    }
  }, [tournament.id]);

  // 3. Cargar estado de categorías y llaves de este torneo
  const loadBrackets = useCallback(async () => {
    setLoadingBrackets(true);
    try {
      const res = await getTournamentCategoriesStatusAction(tournament.id);
      if (res.success) {
        setCategories(res.categories);
        const targetCatId = selectedCategoryId || (res.categories.length > 0 ? res.categories[0].id : null);
        if (targetCatId && !selectedCategoryId) {
          setSelectedCategoryId(targetCatId);
        }

        // Si la categoría objetivo ya tiene combates generados, cargarlos de inmediato
        if (targetCatId) {
          const targetCat = res.categories.find((c) => c.id === targetCatId);
          if (targetCat && targetCat.matches_generated) {
            getCategoryBracketAction(targetCatId, tournament.id).then((bracketRes) => {
              if (bracketRes.success && bracketRes.result) {
                setCategoryBrackets((prev) => ({
                  ...prev,
                  [targetCatId]: bracketRes.result!,
                }));
              }
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Error cargando llaves del torneo:', err);
    } finally {
      setLoadingBrackets(false);
    }
  }, [tournament.id, selectedCategoryId]);

  // Cargar llave guardada de una categoría si no está en memoria
  const loadCategoryBracket = useCallback(
    async (categoryId: string) => {
      if (categoryBrackets[categoryId]) return;
      try {
        const res = await getCategoryBracketAction(categoryId, tournament.id);
        if (res.success && res.result) {
          setCategoryBrackets((prev) => ({
            ...prev,
            [categoryId]: res.result!,
          }));
        }
      } catch (err) {
        console.error('Error cargando llave guardada:', err);
      }
    },
    [categoryBrackets, tournament.id]
  );

  // Sincronizar automáticamente la llave de la categoría seleccionada al cambiar o cargar
  useEffect(() => {
    if (selectedCategoryId) {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat && cat.matches_generated && !categoryBrackets[selectedCategoryId]) {
        loadCategoryBracket(selectedCategoryId);
      }
    }
  }, [selectedCategoryId, categories, categoryBrackets, loadCategoryBracket]);

  // 4. Cargar credenciales PIN de las estaciones de este torneo
  const loadCredentials = useCallback(async () => {
    setLoadingCredentials(true);
    try {
      const res = await getTournamentCredentialsAction(tournament.id);
      if (res.success) {
        setCredentials(res.credentials);
      }
    } catch (err: any) {
      console.error('Error cargando credenciales del torneo:', err);
    } finally {
      setLoadingCredentials(false);
    }
  }, [tournament.id]);

  // Disparar carga según la pestaña activa
  useEffect(() => {
    if (activeTab === 'roster') loadRoster();
    if (activeTab === 'weigh_in') loadWeighIn();
    if (activeTab === 'brackets') loadBrackets();
    if (activeTab === 'credentials') loadCredentials();
  }, [activeTab, loadRoster, loadWeighIn, loadBrackets, loadCredentials]);

  // Carga inicial de conteos
  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // ==========================================================================
  // ACCIONES DEL ENCABEZADO
  // ==========================================================================

  // Activar torneo
  const handleSetActive = async () => {
    try {
      await setActiveTournamentAction(tournament.id);
      setTournament((prev) => ({ ...prev, is_active: true, status: 'ACTIVE' }));
      setFeedback({
        type: 'success',
        text: `"${tournament.name}" establecido como el campeonato activo en ejecución.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error activando campeonato.' });
    }
  };

  // Inyectar atletas base al torneo actual
  const handleInjectBaseAthletes = async () => {
    try {
      const res = await injectAthletesToTournamentAction(tournament.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Se inyectaron ${res.count} deportistas oficiales a este campeonato.`,
        });
        loadRoster();
        loadWeighIn();
        loadBrackets();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error al inyectar atletas.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error inesperado inyectando atletas.' });
    }
  };

  // ==========================================================================
  // MANEJADORES DE PESAJE
  // ==========================================================================

  const handleWeightInputChange = (regId: string, val: string) => {
    setWeightInputs((prev) => ({ ...prev, [regId]: val }));
  };

  const handleRecordWeight = async (athlete: WeighInAthlete) => {
    const rawVal = weightInputs[athlete.registration_id];
    const weightNum = parseFloat(rawVal ?? String(athlete.actual_weight || ''));

    if (isNaN(weightNum) || weightNum <= 0) {
      setFeedback({ type: 'error', text: 'Ingresa un peso numérico válido en kg.' });
      return;
    }

    const { valid } = isWeightValidForCategory(weightNum, athlete.category_name);
    const newStatus: WeighInAthlete['weigh_in_status'] = valid ? 'PASSED' : 'DSQ';

    setSavingWeightId(athlete.registration_id);
    try {
      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: weightNum,
        status: newStatus,
        tournamentId: tournament.id,
      });

      if (res.success) {
        setWeighInAthletes((prev) =>
          prev.map((a) =>
            a.registration_id === athlete.registration_id
              ? {
                  ...a,
                  actual_weight: weightNum,
                  weigh_in_status: newStatus,
                  weigh_in_at: new Date().toISOString(),
                }
              : a
          )
        );
        setFeedback({
          type: valid ? 'success' : 'info',
          text: `Peso de ${athlete.name} guardado: ${weightNum} kg (${
            valid ? 'PESO OFICIAL APROBADO' : 'PESO EXCEDIDO / DSQ'
          }).`,
        });
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error guardando peso.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error inesperado al guardar pesaje.' });
    } finally {
      setSavingWeightId(null);
    }
  };

  // Reclasificar atleta a categoría superior sugerida
  const handleReclassifyAthlete = async (athlete: WeighInAthlete, targetCategoryName: string) => {
    setSavingWeightId(athlete.registration_id);
    try {
      const currentWeight = parseFloat(weightInputs[athlete.registration_id] || String(athlete.actual_weight || 0));
      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: currentWeight,
        status: 'PASSED',
        newCategoryName: targetCategoryName,
        tournamentId: tournament.id,
      });

      if (res.success) {
        setWeighInAthletes((prev) =>
          prev.map((a) =>
            a.registration_id === athlete.registration_id
              ? {
                  ...a,
                  category_name: targetCategoryName,
                  weigh_in_status: 'PASSED',
                  actual_weight: currentWeight,
                }
              : a
          )
        );
        setFeedback({
          type: 'success',
          text: `${athlete.name} reclasificado exitosamente a ${targetCategoryName}.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error reclasificando atleta.' });
    } finally {
      setSavingWeightId(null);
    }
  };

  // ==========================================================================
  // MANEJADORES DE LLAVES & BRACKETS
  // ==========================================================================

  const handleGenerateBracket = async (category: CategoryBracketStatus) => {
    setIsGeneratingBrackets(true);
    try {
      const res = await generateCategoryMatchesAction({
        categoryId: category.id,
        tatamiNumber: category.assigned_tatami_number || 1,
        tournamentId: tournament.id,
      });

      if (res.success && res.result) {
        setCategoryBrackets((prev) => ({
          ...prev,
          [category.id]: res.result!,
        }));
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, matches_generated: true } : c))
        );
        setFeedback({
          type: 'success',
          text: `¡Llaves generadas para ${category.name}! (${res.result.total_matches} combates programados).`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'No fue posible generar la llave de la categoría.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error al generar la llave.' });
    } finally {
      setIsGeneratingBrackets(false);
    }
  };

  const handleSaveBracketModification = async (bracket: BracketResult) => {
    if (!selectedCategoryId) return;
    try {
      const res = await saveModifiedBracketAction({
        categoryId: selectedCategoryId,
        bracketResult: bracket,
        tournamentId: tournament.id,
      });

      if (res.success) {
        setCategoryBrackets((prev) => ({
          ...prev,
          [selectedCategoryId]: bracket,
        }));
        setFeedback({
          type: 'success',
          text: 'Modificaciones del sorteo guardadas en la base de datos.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error guardando modificaciones de la llave.' });
    }
  };

  // ==========================================================================
  // MANEJADORES DE CREDENCIALES
  // ==========================================================================

  const handleCopyPin = (slug: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleCopyAll = () => {
    if (credentials.length === 0) return;
    let text = `=========================================\n`;
    text += `CREDENCIALES OFICIALES DE TORNEO (PIN)\n`;
    text += `Torneo: ${tournament.name}\n`;
    text += `Sede: ${tournament.location || 'Polideportivo'}\n`;
    text += `Fecha: ${tournament.start_date}\n`;
    text += `=========================================\n\n`;
    credentials.forEach((cred) => {
      text += `TATAMI ${cred.tatami_number} (${cred.station_slug}): PIN -> ${cred.pin}\n`;
      text += `Ruta Directa: /tatami/${cred.tatami_number}\n\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtrado de atletas en pesaje
  const filteredWeighInAthletes = useMemo(() => {
    return weighInAthletes.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(weighInSearch.toLowerCase()) ||
        a.rut_dni.toLowerCase().includes(weighInSearch.toLowerCase()) ||
        a.club_name.toLowerCase().includes(weighInSearch.toLowerCase());
      const matchCat =
        weighInCategoryFilter === 'ALL' || a.category_name === weighInCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [weighInAthletes, weighInSearch, weighInCategoryFilter]);

  const weighInCategoriesList = useMemo(() => {
    return Array.from(new Set(weighInAthletes.map((a) => a.category_name))).filter(Boolean);
  }, [weighInAthletes]);

  const activeCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ==================================================================== */}
      {/* ENCABEZADO MAESTRO AISLADO DEL CAMPEONATO */}
      {/* ==================================================================== */}
      <header className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <Link
              href="/admin/tournaments"
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition font-bold mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Lista de Campeonatos</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center space-x-2">
                <Trophy className="w-7 h-7 text-amber-400 flex-shrink-0" />
                <span>{tournament.name}</span>
              </h1>
              {tournament.is_active ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Torneo Activo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSetActive}
                  className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition"
                >
                  Establecer como Activo
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{tournament.location || 'Sede Principal'}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {tournament.start_date}{' '}
                  {tournament.end_date && tournament.end_date !== tournament.start_date
                    ? `al ${tournament.end_date}`
                    : ''}
                </span>
              </span>
              <span className="flex items-center space-x-1 font-mono text-slate-500">
                <span>ID: {tournament.id.slice(0, 8)}...</span>
              </span>
            </div>
          </div>

          {/* ACCIÓN RÁPIDA: INYECTAR ATLETAS SI ESTÁ VACÍO */}
          {registeredAthletes.length === 0 && (
            <button
              type="button"
              onClick={handleInjectBaseAthletes}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 shadow-lg flex-shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Inyectar Nómina Base (8 Atletas)</span>
            </button>
          )}
        </div>

        {/* MÉTRICAS DE AISLAMIENTO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Deportistas Inscritos
            </span>
            <span className="text-xl font-black text-emerald-400 mt-0.5 block">
              {registeredAthletes.length}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Tatamis Operativos
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">
              {tournament.tatami_count}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Categorías Activas
            </span>
            <span className="text-xl font-black text-blue-400 mt-0.5 block">
              {categories.length || (registeredAthletes.length > 0 ? 4 : 0)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Pesaje Aprobado
            </span>
            <span className="text-xl font-black text-amber-400 mt-0.5 block">
              {weighInAthletes.filter((a) => a.weigh_in_status === 'PASSED').length} /{' '}
              {weighInAthletes.length}
            </span>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <nav className="flex space-x-2 border-t border-slate-800 pt-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'roster'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Nómina & Inscripciones ({registeredAthletes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weigh_in')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'weigh_in'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>2. Estación de Pesaje</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('brackets')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'brackets'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>3. Llaves & Sorteo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'credentials'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>4. Tatamis & Credenciales PIN</span>
          </button>
        </nav>
      </header>

      {/* FEEDBACK GLOBAL */}
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

      {/* ==================================================================== */}
      {/* PESTAÑA 1: NÓMINA & INSCRIPCIONES (ACREDITACIÓN AISLADA) */}
      {/* ==================================================================== */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* TABLA DE ATLETAS YA CONFIRMADOS EN ESTE TORNEO */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Atletas Confirmados en este Campeonato ({registeredAthletes.length})
                </h3>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Buscar por RUT, Nombre o Club..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 w-64"
                />
                <button
                  type="button"
                  onClick={loadRoster}
                  disabled={loadingRoster}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRoster ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {registeredAthletes.length === 0 ? (
              <div className="p-12 text-center space-y-3 text-slate-500">
                <Users className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-400">
                  No hay atletas inscritos todavía en "{tournament.name}".
                </p>
                <p className="text-xs max-w-md mx-auto">
                  Usa el formulario inferior para agregar atletas individualmente, importa un archivo
                  CSV, o presiona "Inyectar Nómina Base" arriba para pruebas rápidas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">RUT / DNI</th>
                      <th className="p-3">Nombre Completo</th>
                      <th className="p-3">Club</th>
                      <th className="p-3">Año / Sexo</th>
                      <th className="p-3">Categoría Oficial</th>
                      <th className="p-3 text-center">Estado Pesaje</th>
                      <th className="p-3 text-right">Peso Real</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {registeredAthletes
                      .filter((ath) => {
                        const q = rosterSearch.toLowerCase();
                        return (
                          ath.name.toLowerCase().includes(q) ||
                          ath.rut_dni.toLowerCase().includes(q) ||
                          ath.club_name.toLowerCase().includes(q) ||
                          ath.category_name.toLowerCase().includes(q)
                        );
                      })
                      .map((ath) => (
                        <tr key={ath.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono font-bold text-amber-400">{ath.rut_dni}</td>
                          <td className="p-3 font-bold text-white">{ath.name}</td>
                          <td className="p-3 text-slate-300">{ath.club_name}</td>
                          <td className="p-3 text-slate-400">
                            {ath.birth_year} ({ath.gender === 'M' ? 'Masc' : 'Fem'})
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800/80 text-[11px] font-bold">
                              {ath.category_name}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                ath.weigh_in_status === 'PASSED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : ath.weigh_in_status === 'DSQ'
                                  ? 'bg-red-950 text-red-400 border border-red-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {ath.weigh_in_status === 'PASSED'
                                ? 'PESADO'
                                : ath.weigh_in_status === 'DSQ'
                                ? 'DSQ'
                                : 'PENDIENTE'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {ath.actual_weight ? `${ath.actual_weight} kg` : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* FORMULARIO Y DROPZONE DE INSCRIPCIÓN (ESCOPADO A ESTE TORNEO) */}
          <div className="pt-2">
            <RosterUpload
              tournamentId={tournament.id}
              onRegistrationsConfirmed={() => {
                loadRoster();
                loadWeighIn();
              }}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 2: ESTACIÓN DE PESAJE AISLADA */}
      {/* ==================================================================== */}
      {activeTab === 'weigh_in' && (
        <div className="space-y-6">
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <Scale className="w-5 h-5 text-amber-400" />
                  <span>Estación de Pesaje Oficial - {tournament.name}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registra el peso en báscula. Si el atleta excede su división, el sistema sugerirá la
                  categoría inmediata superior para reclasificación con un clic.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={loadWeighIn}
                  disabled={loadingWeighIn}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWeighIn ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* FILTROS RÁPIDOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por RUT, Nombre o Club..."
                  value={weighInSearch}
                  onChange={(e) => setWeighInSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <select
                  value={weighInCategoryFilter}
                  onChange={(e) => setWeighInCategoryFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Todas las Categorías del Torneo</option>
                  {weighInCategoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* TABLA DE PESAJE */}
            {filteredWeighInAthletes.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-slate-500">
                <Scale className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold">No hay atletas registrados para el pesaje.</p>
                <p className="text-xs">
                  Ve a la pestaña "Nómina & Inscripciones" para registrar participantes en este torneo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Atleta</th>
                      <th className="p-3">Categoría Asignada</th>
                      <th className="p-3">Límite IJF</th>
                      <th className="p-3 text-center">Peso Real (kg)</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredWeighInAthletes.map((ath) => {
                      const inputVal =
                        weightInputs[ath.registration_id] ?? (ath.actual_weight?.toString() || '');
                      const numVal = parseFloat(inputVal);
                      const parsedLimit = parseWeightLimitFromCategory(ath.category_name);
                      const hasWeight = !isNaN(numVal) && numVal > 0;
                      const weightCheck = hasWeight
                        ? isWeightValidForCategory(numVal, ath.category_name)
                        : null;
                      const isOverweight = weightCheck ? !weightCheck.valid : false;
                      const suggestedCat = isOverweight
                        ? getSuggestedUpperCategory(ath.category_name, numVal)
                        : null;

                      return (
                        <tr key={ath.registration_id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <span className="font-bold text-white block">{ath.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {ath.rut_dni} · {ath.club_name}
                            </span>
                          </td>

                          <td className="p-3">
                            <span className="font-bold text-blue-300">{ath.category_name}</span>
                          </td>

                          <td className="p-3 font-mono text-slate-400">
                            {parsedLimit
                              ? parsedLimit.isPlus
                                ? `≥ ${parsedLimit.limit} kg`
                                : `≤ ${parsedLimit.limit} kg`
                              : 'Abierto'}
                          </td>

                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="00.0"
                                value={inputVal}
                                onChange={(e) =>
                                  handleWeightInputChange(ath.registration_id, e.target.value)
                                }
                                className={`w-20 px-2.5 py-1 text-center font-mono font-bold rounded-lg border text-xs ${
                                  isOverweight
                                    ? 'bg-red-950/80 border-red-500 text-red-300'
                                    : 'bg-slate-950 border-slate-700 text-white'
                                }`}
                              />
                              <span className="text-slate-500 text-[11px]">kg</span>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            {ath.weigh_in_status === 'PASSED' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                                APROBADO
                              </span>
                            ) : ath.weigh_in_status === 'DSQ' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800">
                                EXCEDIDO
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-400 border border-amber-800">
                                PENDIENTE
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {suggestedCat && (
                                <button
                                  type="button"
                                  onClick={() => handleReclassifyAthlete(ath, suggestedCat)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-bold transition flex items-center space-x-1"
                                  title={`Reclasificar a ${suggestedCat}`}
                                >
                                  <span>Subir a {suggestedCat.split(' ').pop()}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRecordWeight(ath)}
                                disabled={savingWeightId === ath.registration_id}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition"
                              >
                                {savingWeightId === ath.registration_id ? '...' : 'Guardar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 3: LLAVES & VISOR DE SORTEO AISLADO */}
      {/* ==================================================================== */}
      {activeTab === 'brackets' && (
        <div className="space-y-6">
          {/* SELECTOR DE CATEGORÍAS */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Sorteo y Visor de Llaves - {tournament.name}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Genera las llaves oficiales según el pesaje cerrado. Modifica cruces o visualiza el
                  árbol de eliminación / Round Robin.
                </p>
              </div>

              <button
                type="button"
                onClick={loadBrackets}
                disabled={loadingBrackets}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBrackets ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-slate-500">
                <Trophy className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold">No hay categorías configuradas en este campeonato.</p>
                <p className="text-xs">
                  Inscribe atletas en la pestaña de Nómina o inyecta los datos de prueba para comenzar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {categories.map((cat) => {
                  const isSelected = cat.id === selectedCategoryId;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`p-3.5 rounded-xl border text-left transition space-y-2 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-md'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Tatami {cat.assigned_tatami_number}
                        </span>
                        {cat.matches_generated ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Generada
                          </span>
                        ) : cat.is_weigh_in_closed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-950 text-blue-400 border border-blue-800">
                            Pesaje OK
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-400 border border-amber-800">
                            Pesaje Pendiente
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-white truncate">{cat.name}</h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>
                          {cat.passed_weigh_in} / {cat.total_registered} pesados
                        </span>
                        <span className="font-mono text-amber-400">
                          {cat.bracket_type === 'ROUND_ROBIN'
                            ? 'Berger (RR)'
                            : cat.bracket_type === 'BEST_OF_3'
                            ? 'Best of 3'
                            : 'Eliminación'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* VISOR DE LLAVE DE LA CATEGORÍA SELECCIONADA */}
          {activeCategory && (
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white flex items-center space-x-2">
                    <span>{activeCategory.name}</span>
                    <span className="text-xs text-amber-400 font-mono">
                      (Tatami {activeCategory.assigned_tatami_number})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tipo de Cruce:{' '}
                    <strong className="text-white">
                      {activeCategory.bracket_type === 'ROUND_ROBIN'
                        ? 'Todos contra Todos (Round Robin Berger)'
                        : activeCategory.bracket_type === 'BEST_OF_3'
                        ? 'Al Mejor de 3'
                        : 'Eliminación Simple IJF'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateBracket(activeCategory)}
                    disabled={isGeneratingBrackets || activeCategory.passed_weigh_in < 2}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center space-x-2 ${
                      activeCategory.passed_weigh_in < 2
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <Swords className="w-4 h-4" />
                    <span>
                      {isGeneratingBrackets
                        ? 'Generando...'
                        : activeCategory.matches_generated
                        ? 'Regenerar Llave'
                        : 'Generar Llave'}
                    </span>
                  </button>

                  <Link
                    href={`/admin/tatami/${activeCategory.assigned_tatami_number}`}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1"
                  >
                    <span>Ir a Cola Tatami {activeCategory.assigned_tatami_number}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* RENDER DEL BRACKET VIEWER */}
              {categoryBrackets[activeCategory.id] ? (
                <BracketViewer
                  bracketResult={categoryBrackets[activeCategory.id]}
                  categoryName={activeCategory.name}
                  onSaveModifiedBracket={handleSaveBracketModification}
                />
              ) : (
                <div className="p-12 text-center space-y-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <Swords className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-bold text-white">
                    {activeCategory.matches_generated
                      ? 'Cargando visualización del sorteo...'
                      : 'Presiona "Generar Llave" para estructurar los cruces oficiales de esta categoría.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    El motor matemático respetará las reglas oficiales IJF: si hay 2 competidores se
                    disputará al Mejor de 3, entre 3 y 5 se generará Round Robin (Berger), y para 6 o más
                    se dibujará el árbol de eliminación directa.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 4: TATAMIS Y CREDENCIALES PIN AISLADAS */}
      {/* ==================================================================== */}
      {activeTab === 'credentials' && (
        <div className="space-y-6">
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <span>Credenciales PIN de Tatamis - {tournament.name}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  PINs criptográficos generados para cada mesa de control. Imprime estas fichas o
                  cópialas para entregarlas a los operadores el día del campeonato.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1.5"
                >
                  {copiedAll ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedAll ? '¡Copiado!' : 'Copiar Todas'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 shadow-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Fichas Oficiales</span>
                </button>
              </div>
            </div>

            {/* TARJETAS DE CREDENCIALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
              {credentials.map((cred) => (
                <div
                  key={cred.station_slug}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Tatami {cred.tatami_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Mesa Habilitada
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white">{cred.station_name}</h4>
                    <span className="text-xs font-mono text-slate-400">
                      Slug: {cred.station_slug}
                    </span>
                  </div>

                  {/* CAJA DEL PIN */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        PIN de Acceso
                      </span>
                      <span className="text-2xl font-black font-mono tracking-widest text-amber-400">
                        {cred.pin}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyPin(cred.station_slug, cred.pin)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Copiar PIN"
                    >
                      {copiedSlug === cred.station_slug ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* ACCESOS DIRECTOS DEL TATAMI */}
                  <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <Link
                      href={`/tatami/${cred.tatami_number}`}
                      target="_blank"
                      className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold border border-slate-800 flex items-center justify-center space-x-1 transition"
                      title="Abrir Mesa de Control y Arbitraje"
                    >
                      <PlayCircle className="w-3 h-3 text-emerald-400" />
                      <span>Mesa</span>
                    </Link>

                    <Link
                      href={`/scoreboard/tatami-${cred.tatami_number}`}
                      target="_blank"
                      className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 font-bold border border-slate-800 flex items-center justify-center space-x-1 transition"
                      title="Abrir Marcador TV en tiempo real"
                    >
                      <Tv className="w-3 h-3 text-purple-400" />
                      <span>TV</span>
                    </Link>

                    <Link
                      href={`/admin/tatami/${cred.tatami_number}`}
                      className="py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold border border-amber-500/30 flex items-center justify-center space-x-1 transition"
                      title="Ver Cola de Combates programados"
                    >
                      <Swords className="w-3 h-3" />
                      <span>Cola</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
