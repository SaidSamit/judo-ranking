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
import { useSearchParams } from 'next/navigation';
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
  Plus,
  X,
  Layers,
} from 'lucide-react';
import { TournamentItem, setActiveTournamentAction, injectAthletesToTournamentAction } from '@/app/actions/tournaments';
import {
  getTournamentRegistrationsAction,
  RegisteredAthleteSummary,
  reassignAthleteCategoryAction,
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
  reassignCategoryTatamiAction,
  createTournamentCategoryAction,
  getTournamentPodiumsAction,
  CategoryPodiumResult,
} from '@/app/actions/brackets';
import {
  getTournamentCredentialsAction,
  TatamiCredential,
} from '@/app/actions/tournament-builder';
import { BracketViewer } from '@/components/admin/bracket-viewer';
import { RosterUpload } from '@/components/admin/roster-upload';
import { MultiTatamiMonitorView } from '@/components/admin/multi-tatami-monitor-view';
import { BracketResult } from '@/lib/rules/bracket-engine';
import {
  isWeightValidForCategory,
  getSuggestedUpperCategory,
  parseWeightLimitFromCategory,
  getWeightsForAgeDivision,
  getRecommendedDuration,
  JUDO_AGE_DIVISIONS,
} from '@/lib/rules/judo-categories';

type DashboardTab = 'roster' | 'weigh_in' | 'brackets' | 'credentials' | 'tatamis' | 'results';

interface TournamentDashboardViewProps {
  initialTournament: TournamentItem;
}

export function TournamentDashboardView({ initialTournament }: TournamentDashboardViewProps) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const [tournament, setTournament] = useState<TournamentItem>(initialTournament);
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    requestedTab === 'tatamis' || requestedTab === 'monitor'
      ? 'tatamis'
      : requestedTab === 'weigh_in'
      ? 'weigh_in'
      : requestedTab === 'brackets'
      ? 'brackets'
      : requestedTab === 'credentials'
      ? 'credentials'
      : 'roster'
  );
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
  const [isReassigning, setIsReassigning] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatAgeGroup, setNewCatAgeGroup] = useState('Senior');
  const [newCatGender, setNewCatGender] = useState<'M' | 'F' | 'MIXED'>('M');
  const [newCatWeight, setNewCatWeight] = useState('73');
  const [newCatDuration, setNewCatDuration] = useState('4');
  const [newCatTatami, setNewCatTatami] = useState('0');

  // ==========================================================================
  // ESTADOS DE PESTAÑA 4: CREDENCIALES PIN
  // ==========================================================================
  const [credentials, setCredentials] = useState<TatamiCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ==========================================================================
  // ESTADOS DE PESTAÑA 6: RESULTADOS Y PODIO
  // ==========================================================================
  const [podiumResults, setPodiumResults] = useState<CategoryPodiumResult[]>([]);
  const [loadingPodiums, setLoadingPodiums] = useState(false);

  // Estado para modal rápido de reasignar judoka a otra categoría
  const [reassigningAthlete, setReassigningAthlete] = useState<RegisteredAthleteSummary | null>(null);
  const [reassignTargetCatId, setReassignTargetCatId] = useState<string>('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

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

  // 5. Cargar resultados y podios oficiales del torneo
  const loadPodiums = useCallback(async () => {
    setLoadingPodiums(true);
    try {
      const res = await getTournamentPodiumsAction(tournament.id);
      if (res.success) {
        setPodiumResults(res.results);
      }
    } catch (err: any) {
      console.error('Error cargando podio del torneo:', err);
    } finally {
      setLoadingPodiums(false);
    }
  }, [tournament.id]);

  // Manejador para reasignar a un judoka confirmado a otra categoría
  const handleReassignAthleteCategory = async () => {
    if (!reassigningAthlete || !reassignTargetCatId) return;
    setIsSubmittingReassign(true);
    try {
      const res = await reassignAthleteCategoryAction({
        registrationId: reassigningAthlete.id,
        targetCategoryId: reassignTargetCatId,
        tournamentId: tournament.id,
      });

      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
        setReassigningAthlete(null);
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error reasignando categoría.' });
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Disparar carga según la pestaña activa
  useEffect(() => {
    if (activeTab === 'roster') loadRoster();
    if (activeTab === 'weigh_in') loadWeighIn();
    if (activeTab === 'brackets') loadBrackets();
    if (activeTab === 'credentials') loadCredentials();
    if (activeTab === 'results') loadPodiums();
  }, [activeTab, loadRoster, loadWeighIn, loadBrackets, loadCredentials, loadPodiums]);

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

  const handleReassignTatami = async (categoryId: string, newTatamiNumber: number) => {
    setIsReassigning(true);
    try {
      const res = await reassignCategoryTatamiAction({
        categoryId,
        newTatamiNumber,
        tournamentId: tournament.id,
      });
      if (res.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, assigned_tatami_number: newTatamiNumber } : c))
        );
        setFeedback({
          type: 'success',
          text: res.message,
        });
        await loadBrackets();
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error al reasignar tatami.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al reasignar tatami.' });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const res = await createTournamentCategoryAction({
        tournamentId: tournament.id,
        name: newCatName.trim(),
        age_group: newCatAgeGroup,
        gender: newCatGender,
        max_weight: Number(newCatWeight) || 73,
        match_duration_seconds: (Number(newCatDuration) || 4) * 60,
        assigned_tatami_number: Number(newCatTatami) > 0 ? Number(newCatTatami) : undefined,
      });
      if (res.success) {
        setIsNewCategoryModalOpen(false);
        setNewCatName('');
        setFeedback({
          type: 'success',
          text: res.message,
        });
        await loadBrackets();
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error creando la categoría.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al crear la categoría.' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const tatamiDistribution = useMemo(() => {
    const totalTatamis = tournament.tatami_count || 2;
    const stats = new Map<number, { categoriesCount: number; athletesCount: number }>();
    for (let t = 1; t <= totalTatamis; t++) {
      stats.set(t, { categoriesCount: 0, athletesCount: 0 });
    }
    categories.forEach((cat) => {
      const t = cat.assigned_tatami_number || 1;
      const cur = stats.get(t) || { categoriesCount: 0, athletesCount: 0 };
      stats.set(t, {
        categoriesCount: cur.categoriesCount + 1,
        athletesCount: cur.athletesCount + (cat.passed_weigh_in || cat.total_registered || 0),
      });
    });
    return Array.from(stats.entries()).map(([tatamiNum, data]) => ({
      tatamiNum,
      ...data,
    }));
  }, [categories, tournament.tatami_count]);

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none">
      <div className="print:hidden space-y-6">
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
            <span>Inscripciones ({registeredAthletes.length})</span>
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
            <span>Estación de Pesaje</span>
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
            <span>Sorteo</span>
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
            <span>Tatamis y Credenciales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tatamis')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'tatamis'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Monitor Multi-Tatami</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'results'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Resultados y Podio</span>
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
                      <th className="p-3">RUT</th>
                      <th className="p-3">Nombre Completo</th>
                      <th className="p-3">Club</th>
                      <th className="p-3">Año / Sexo</th>
                      <th className="p-3">Categoría Oficial</th>
                      <th className="p-3 text-center">Estado Pesaje</th>
                      <th className="p-3 text-right">Peso Real</th>
                      <th className="p-3 text-right">Acción</th>
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
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReassigningAthlete(ath);
                                setReassignTargetCatId(ath.category_id || (categories[0]?.id || ''));
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold transition"
                              title="Cambiar o reasignar categoría"
                            >
                              Cambiar Categoría
                            </button>
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
              tournamentCategories={categories}
              onRegistrationsConfirmed={() => {
                loadRoster();
                loadWeighIn();
                loadBrackets();
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
                      <th className="p-3">Límite Oficial</th>
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

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Nueva Categoría</span>
                </button>
                <button
                  type="button"
                  onClick={loadBrackets}
                  disabled={loadingBrackets}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center space-x-1 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBrackets ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* BALANCEO DE CARGA POR TATAMI */}
            {tatamiDistribution.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Distribución de Carga:
                </span>
                {tatamiDistribution.map((t) => (
                  <div
                    key={t.tatamiNum}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                    <span className="text-amber-400 font-bold">Tatami #{t.tatamiNum}:</span>
                    <span className="text-slate-300">
                      {t.categoriesCount} cat. ({t.athletesCount} atletas)
                    </span>
                  </div>
                ))}
              </div>
            )}

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
                      (Tatami #{activeCategory.assigned_tatami_number})
                    </span>
                  </h3>

                  {/* SELECTOR RÁPIDO DE REASIGNACIÓN DE TATAMI */}
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-xs text-slate-400 font-medium">Reasignar Tatami:</span>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: tournament.tatami_count || 2 }, (_, i) => i + 1).map((tNum) => (
                        <button
                          key={tNum}
                          type="button"
                          onClick={() => handleReassignTatami(activeCategory.id, tNum)}
                          disabled={isReassigning || activeCategory.assigned_tatami_number === tNum}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                            activeCategory.assigned_tatami_number === tNum
                              ? 'bg-amber-500 text-slate-950 font-black shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                          } ${isReassigning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Tatami {tNum}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-1.5">
                    Tipo de Cruce:{' '}
                    <strong className="text-white">
                      {activeCategory.bracket_type === 'ROUND_ROBIN'
                        ? 'Todos contra Todos (Round Robin Berger)'
                        : activeCategory.bracket_type === 'BEST_OF_3'
                        ? 'Al Mejor de 3'
                        : 'Eliminación Simple'}
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
                    El motor matemático respetará las reglas oficiales: si hay 2 competidores se
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
                  <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-center text-[11px]">
                    <Link
                      href={`/tatami/${cred.tatami_number}`}
                      target="_blank"
                      className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold border border-slate-800 flex items-center justify-center space-x-1.5 transition"
                      title="Abrir Mesa de Control y Arbitraje"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mesa</span>
                    </Link>

                    <Link
                      href={`/scoreboard/tatami-${cred.tatami_number}`}
                      target="_blank"
                      className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 font-bold border border-slate-800 flex items-center justify-center space-x-1.5 transition"
                      title="Abrir Marcador TV en tiempo real"
                    >
                      <Tv className="w-3.5 h-3.5 text-purple-400" />
                      <span>TV</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 5: MONITOR MULTI-TATAMI EN CASCADA                           */}
      {/* ==================================================================== */}
      {activeTab === 'tatamis' && (
        <div className="space-y-4">
          <MultiTatamiMonitorView
            initialTournamentId={tournament.id}
            initialTournamentName={tournament.name}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 6: RESULTADOS Y PODIO OFICIAL                                */}
      {/* ==================================================================== */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Resultados Oficiales y Podios - {tournament.name}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cuadro de honor con 1° (Oro), 2° (Plata), 3° (Doble Bronce olímpico), 5° y 7° lugar por categoría.
                </p>
              </div>

              <button
                type="button"
                onClick={loadPodiums}
                disabled={loadingPodiums}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPodiums ? 'animate-spin' : ''}`} />
                <span>Actualizar Podios</span>
              </button>
            </div>

            {podiumResults.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Trophy className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-400">No hay categorías configuradas o combates disputados aún.</p>
                <p className="text-xs">A medida que se definan los combates en la mesa de control, los resultados se reflejarán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {podiumResults.map((pr) => (
                  <div
                    key={pr.categoryId}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div>
                        <h3 className="text-base font-black text-white">{pr.categoryName}</h3>
                        <span className="text-xs text-slate-400">
                          {pr.ageGroup} • {pr.gender === 'M' ? 'Masculino' : pr.gender === 'F' ? 'Femenino' : 'Mixto'}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          pr.isFinished
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {pr.isFinished ? 'Concluida' : `${pr.finishedMatches}/${pr.totalMatches} Combates`}
                      </span>
                    </div>

                    {/* MEDALLERO OFICIAL */}
                    <div className="space-y-2">
                      {/* 1° Lugar (Oro) */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                            1°
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {pr.podium.firstPlace ? pr.podium.firstPlace.name : 'Por definir'}
                            </span>
                            <span className="text-[11px] text-amber-300/80 block">
                              {pr.podium.firstPlace ? pr.podium.firstPlace.club : '—'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">ORO</span>
                      </div>

                      {/* 2° Lugar (Plata) */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-400/10 border border-slate-400/30">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                            2°
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {pr.podium.secondPlace ? pr.podium.secondPlace.name : 'Por definir'}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {pr.podium.secondPlace ? pr.podium.secondPlace.club : '—'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">PLATA</span>
                      </div>

                      {/* 3° Lugares (Doble Bronce IJF) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Bronce A */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-orange-700/15 border border-orange-600/30">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black text-[11px] flex items-center justify-center">
                              3°
                            </span>
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">
                                {pr.podium.thirdPlaceA ? pr.podium.thirdPlaceA.name : 'Por definir'}
                              </span>
                              <span className="text-[10px] text-orange-300/80 block truncate">
                                {pr.podium.thirdPlaceA ? pr.podium.thirdPlaceA.club : '—'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase text-orange-400 flex-shrink-0">BRONCE</span>
                        </div>

                        {/* Bronce B */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-orange-700/15 border border-orange-600/30">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black text-[11px] flex items-center justify-center">
                              3°
                            </span>
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">
                                {pr.podium.thirdPlaceB ? pr.podium.thirdPlaceB.name : 'Por definir'}
                              </span>
                              <span className="text-[10px] text-orange-300/80 block truncate">
                                {pr.podium.thirdPlaceB ? pr.podium.thirdPlaceB.club : '—'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase text-orange-400 flex-shrink-0">BRONCE</span>
                        </div>
                      </div>

                      {/* 5° Lugares */}
                      {pr.podium.fifthPlaces.length > 0 && (
                        <div className="pt-1 text-[11px] text-slate-400 flex flex-wrap gap-2">
                          <span className="font-bold text-slate-500">5° Lugar:</span>
                          {pr.podium.fifthPlaces.map((f, i) => (
                            <span key={i} className="text-slate-300">
                              {f.name} ({f.club}){i < pr.podium.fifthPlaces.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 7° Lugares */}
                      {pr.podium.seventhPlaces.length > 0 && (
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                          <span className="font-bold text-slate-500">7° Lugar:</span>
                          {pr.podium.seventhPlaces.map((s, i) => (
                            <span key={i} className="text-slate-400">
                              {s.name} ({s.club}){i < pr.podium.seventhPlaces.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL: REASIGNAR JUDOKA A OTRA CATEGORÍA */}
      {reassigningAthlete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Reasignar Judoka a Otra Categoría</span>
              </h3>
              <button
                type="button"
                onClick={() => setReassigningAthlete(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="text-white font-bold">{reassigningAthlete.name}</p>
                <p className="text-slate-400 font-mono">RUT: {reassigningAthlete.rut_dni} • Club: {reassigningAthlete.club_name}</p>
                <p className="text-amber-400">Categoría actual: <span className="font-bold">{reassigningAthlete.category_name}</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nueva Categoría de Destino
                </label>
                <select
                  value={reassignTargetCatId}
                  onChange={(e) => setReassignTargetCatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Tatami #{c.assigned_tatami_number || 1})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReassigningAthlete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingReassign}
                onClick={handleReassignAthleteCategory}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow"
              >
                {isSubmittingReassign ? 'Reasignando...' : 'Confirmar Reasignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR NUEVA CATEGORÍA EN VIVO */}
      {isNewCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Nueva Categoría de Combate</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Senior Masculino -73kg"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    División de Edad
                  </label>
                  <select
                    value={newCatAgeGroup}
                    onChange={(e) => {
                      const newAge = e.target.value;
                      setNewCatAgeGroup(newAge);
                      const g = newCatGender === 'F' ? 'F' : 'M';
                      const weights = getWeightsForAgeDivision(newAge, g);
                      if (weights.length > 0) {
                        const parsedW = weights[0].replace(/[^0-9]/g, '');
                        setNewCatWeight(parsedW || '73');
                        const genStr = g === 'F' ? 'Femenino' : 'Masculino';
                        setNewCatName(`${newAge} ${genStr} ${weights[0]}`);
                      }
                      setNewCatDuration(String(getRecommendedDuration(newAge)));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {JUDO_AGE_DIVISIONS.map((div) => (
                      <option key={div.ageGroup} value={div.ageGroup}>
                        {div.ageGroup}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Género
                  </label>
                  <select
                    value={newCatGender}
                    onChange={(e) => {
                      const newG = e.target.value as 'M' | 'F' | 'MIXED';
                      setNewCatGender(newG);
                      const g = newG === 'F' ? 'F' : 'M';
                      const weights = getWeightsForAgeDivision(newCatAgeGroup, g);
                      if (weights.length > 0) {
                        const parsedW = weights[0].replace(/[^0-9]/g, '');
                        setNewCatWeight(parsedW || '73');
                        const genStr = g === 'F' ? 'Femenino' : 'Masculino';
                        setNewCatName(`${newCatAgeGroup} ${genStr} ${weights[0]}`);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="MIXED">Mixto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Peso Oficial (Desplegable)
                  </label>
                  <select
                    value={newCatWeight}
                    onChange={(e) => {
                      const wVal = e.target.value;
                      setNewCatWeight(wVal);
                      const gStr = newCatGender === 'F' ? 'Femenino' : 'Masculino';
                      setNewCatName(`${newCatAgeGroup} ${gStr} -${wVal}kg`);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {getWeightsForAgeDivision(newCatAgeGroup, newCatGender === 'F' ? 'F' : 'M').map((wStr) => {
                      const numericW = wStr.replace(/[^0-9]/g, '');
                      return (
                        <option key={wStr} value={numericW || '73'}>
                          {wStr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Duración (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCatDuration}
                    onChange={(e) => setNewCatDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Tatami Asignado
                </label>
                <select
                  value={newCatTatami}
                  onChange={(e) => setNewCatTatami(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="0">⚡ Auto-balancear según carga</option>
                  {Array.from({ length: tournament.tatami_count || 2 }, (_, i) => i + 1).map((tNum) => (
                    <option key={tNum} value={tNum}>
                      Tatami #{tNum}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCategory}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow"
                >
                  {isCreatingCategory ? 'Creando...' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* ==================================================================== */}
      {/* VISTA DE IMPRESIÓN EXCLUSIVA: FICHAS OFICIALES DE MESAS DE CONTROL   */}
      {/* ==================================================================== */}
      <div className="hidden print:block print:w-full print:bg-white text-black font-sans p-6">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <span className="text-xs uppercase font-black tracking-widest text-gray-500 block">
              SISTEMA OFICIAL DE COMPETICIÓN DE JUDO
            </span>
            <h1 className="text-2xl font-black uppercase text-black tracking-tight mt-0.5">
              {tournament.name}
            </h1>
            <p className="text-xs text-gray-700 font-bold mt-1">
              Fichas de Acceso y Credenciales Técnicas de Mesa de Control
            </p>
          </div>
          <div className="text-right text-[11px] text-gray-500 font-mono">
            <span>Fecha de emisión: {new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {credentials.map((cred) => (
            <div
              key={cred.station_slug}
              className="border-2 border-dashed border-gray-400 rounded-2xl p-6 bg-white flex flex-col justify-between space-y-4 break-inside-avoid shadow-none"
            >
              <div className="flex items-center justify-between border-b pb-3 border-gray-300">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Área de Combate
                  </span>
                  <h2 className="text-3xl font-black text-black tracking-tight">
                    TATAMI {cred.tatami_number}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">Estación</span>
                  <span className="text-xs font-mono font-bold bg-gray-100 border border-gray-300 px-2.5 py-0.5 rounded-md">
                    {cred.station_slug}
                  </span>
                </div>
              </div>

              {/* RECUADRO DESTACADO DEL PIN */}
              <div className="bg-gray-100 border-2 border-black rounded-xl p-4 text-center my-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-600 block">
                  PIN DE ACCESO DE LA MESA
                </span>
                <span className="text-4xl font-mono font-black tracking-widest text-black block mt-1">
                  {cred.pin}
                </span>
              </div>

              {/* GUÍA TÉCNICA Y CONTROLES */}
              <div className="text-xs space-y-1.5 text-gray-800 bg-gray-50 p-3.5 rounded-xl border border-gray-300">
                <p className="font-bold text-gray-900 text-[11px] uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
                  Instrucciones Rápidas de Operación:
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  <div><strong>Mesa:</strong> <span className="font-mono">/tatami/{cred.tatami_number}</span></div>
                  <div><strong>Marcador TV:</strong> <span className="font-mono">/scoreboard/tatami-{cred.tatami_number}</span></div>
                  <div><strong>[ESPACIO]</strong> Iniciar / Pausar Cronómetro</div>
                  <div><strong>[1]</strong> Ippon (Fin de combate)</div>
                  <div><strong>[W]</strong> Waza-ari</div>
                  <div><strong>[S]</strong> Shido (Falta técnica)</div>
                  <div><strong>[O]</strong> Osaekomi (Inmovilización)</div>
                  <div><strong>[Enter]</strong> Proclamar & Pasar al siguiente</div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-gray-300 flex justify-between items-center text-[10px] text-gray-400">
                <span>{tournament.name} • Tatami #{cred.tatami_number}</span>
                <span>✂ Cortar ficha por línea punteada</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
