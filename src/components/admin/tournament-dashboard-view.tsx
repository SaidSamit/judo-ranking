// ==============================================================================
// COMPONENTE: PANEL INTEGRADO Y DASHBOARD DE TORNEO (DASHBOARD AISLADO)
// ==============================================================================
//
// REGLAS DE NEGOCIO (AISLAMIENTO DE CAMPEONATOS):
// 1. Patrón Maestro-Detalle: Todo lo que ocurre en este dashboard pertenece
//    estrictamente al tournamentId seleccionado (inscripciones, pesaje, llaves, PINs).
// 2. Cero Fuga de Datos: No se mezclan judokas ni categorías de un torneo con otro.
// 3. Flujo Oficial IJF:
//    - Pestaña 1 (Nómina & Inscripciones): Acreditación y nómina de judokas.
//    - Pestaña 2 (Estación de Pesaje): Captura de peso real y reclasificación.
//    - Pestaña 3 (Llaves & Sorteo): Generación y visualización del árbol / Berger / Pool Doble.
//    - Pestaña 4 (Tatamis & Credenciales): PINs de acceso para mesas y fichas de impresión.
//    - Pestaña 5 (Monitor Multi-Tatami): Monitoreo de colas de combate en vivo.
//    - Pestaña 6 (Resultados y Podio): Cuadro de honor y medallero oficial por clubes.
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
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  TournamentItem,
  setActiveTournamentAction,
  injectAthletesToTournamentAction,
} from '@/app/actions/tournaments';
import {
  getTournamentRegistrationsAction,
  RegisteredAthleteSummary,
  reassignAthleteCategoryAction,
  addAthleteToAdditionalCategoryAction,
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
import { BracketResult } from '@/lib/rules/bracket-engine';
import { isWeightValidForCategory } from '@/lib/rules/judo-categories';

// Subcomponentes modulares de cada pestaña
import { TournamentRosterTab } from './tournament/tournament-roster-tab';
import { TournamentWeighInTab } from './tournament/tournament-weigh-in-tab';
import { TournamentBracketsTab } from './tournament/tournament-brackets-tab';
import { TournamentCredentialsTab } from './tournament/tournament-credentials-tab';
import { TournamentTatamisTab } from './tournament/tournament-tatamis-tab';
import { TournamentResultsTab, ClubMedalRow } from './tournament/tournament-results-tab';
import {
  ReassignCategoryModal,
  AdditionalCategoryModal,
} from './tournament/reassign-category-modal';
import { NewCategoryModal } from './tournament/new-category-modal';

type DashboardTab = 'roster' | 'weigh_in' | 'brackets' | 'credentials' | 'tatamis' | 'results';

interface TournamentDashboardViewProps {
  initialTournament: TournamentItem;
}

export function TournamentDashboardView({ initialTournament }: TournamentDashboardViewProps) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');

  const [tournament, setTournament] = useState<TournamentItem>(initialTournament);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (requestedTab === 'tatamis' || requestedTab === 'monitor') return 'tatamis';
    if (requestedTab === 'weigh_in') return 'weigh_in';
    if (requestedTab === 'brackets') return 'brackets';
    if (requestedTab === 'credentials') return 'credentials';
    if (requestedTab === 'results') return 'results';
    return 'roster';
  });

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Manejo de cambio de pestaña con actualización en URL para marcadores
  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

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
  const [isReassigningTatami, setIsReassigningTatami] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [preferredFormat5ByCategory, setPreferredFormat5ByCategory] = useState<
    Record<string, 'ROUND_ROBIN' | 'DOUBLE_POOL_5'>
  >({});

  // ==========================================================================
  // ESTADOS DE PESTAÑA 4: CREDENCIALES PIN
  // ==========================================================================
  const [credentials, setCredentials] = useState<TatamiCredential[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ==========================================================================
  // ESTADOS DE PESTAÑA 6: RESULTADOS Y PODIO
  // ==========================================================================
  const [podiumResults, setPodiumResults] = useState<CategoryPodiumResult[]>([]);
  const [loadingPodiums, setLoadingPodiums] = useState(false);

  // ==========================================================================
  // MODALES DE REASIGNACIÓN Y CATEGORÍAS ADICIONALES
  // ==========================================================================
  const [reassigningAthlete, setReassigningAthlete] = useState<RegisteredAthleteSummary | null>(null);
  const [reassignTargetCatId, setReassignTargetCatId] = useState<string>('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  const [additionalCatAthlete, setAdditionalCatAthlete] = useState<RegisteredAthleteSummary | null>(null);
  const [additionalTargetCatId, setAdditionalTargetCatId] = useState<string>('');
  const [additionalCustomCatName, setAdditionalCustomCatName] = useState<string>('');
  const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);

  // ==========================================================================
  // CARGA DE DATOS ASÍNCRONOS
  // ==========================================================================

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const res = await getTournamentRegistrationsAction(tournament.id);
      if (res.success && res.athletes) {
        setRegisteredAthletes(res.athletes);
      }
    } finally {
      setLoadingRoster(false);
    }
  }, [tournament.id]);

  const loadWeighIn = useCallback(async () => {
    setLoadingWeighIn(true);
    try {
      const res = await getWeighInAthletesAction(tournament.id);
      if (res.success && res.athletes) {
        setWeighInAthletes(res.athletes);
      }
    } finally {
      setLoadingWeighIn(false);
    }
  }, [tournament.id]);

  const loadBrackets = useCallback(async () => {
    setLoadingBrackets(true);
    try {
      const res = await getTournamentCategoriesStatusAction(tournament.id);
      if (res.success && res.categories) {
        setCategories(res.categories);
        if (!selectedCategoryId && res.categories.length > 0) {
          setSelectedCategoryId(res.categories[0].id);
        }
      }
    } finally {
      setLoadingBrackets(false);
    }
  }, [tournament.id, selectedCategoryId]);

  const loadCategoryBracket = useCallback(
    async (catId: string) => {
      try {
        const res = await getCategoryBracketAction(tournament.id, catId);
        if (res.success && res.result) {
          setCategoryBrackets((prev) => ({ ...prev, [catId]: res.result! }));
        }
      } catch (err: any) {
        console.warn(`[loadCategoryBracket] Error cargando llave ${catId}:`, err);
      }
    },
    [tournament.id]
  );

  const loadCredentials = useCallback(async () => {
    try {
      const res = await getTournamentCredentialsAction(tournament.id);
      if (res.success && res.credentials) {
        setCredentials(res.credentials);
      }
    } catch (err: any) {
      console.warn('[loadCredentials] Error:', err);
    }
  }, [tournament.id]);

  const loadPodiums = useCallback(async () => {
    setLoadingPodiums(true);
    try {
      const res = await getTournamentPodiumsAction(tournament.id);
      if (res.success && res.results) {
        setPodiumResults(res.results);
      }
    } finally {
      setLoadingPodiums(false);
    }
  }, [tournament.id]);

  // Sincronización al montar y al cambiar de pestaña
  useEffect(() => {
    if (activeTab === 'roster') loadRoster();
    if (activeTab === 'weigh_in') loadWeighIn();
    if (activeTab === 'brackets') loadBrackets();
    if (activeTab === 'credentials') loadCredentials();
    if (activeTab === 'results') loadPodiums();
  }, [activeTab, loadRoster, loadWeighIn, loadBrackets, loadCredentials, loadPodiums]);

  // Cargar llave de la categoría activa
  useEffect(() => {
    if (selectedCategoryId && activeTab === 'brackets') {
      loadCategoryBracket(selectedCategoryId);
    }
  }, [selectedCategoryId, activeTab, loadCategoryBracket]);

  // Conteo de inscripciones por judoka (detección de categorías múltiples)
  const athleteRegistrationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    registeredAthletes.forEach((r) => {
      counts.set(r.athlete_id, (counts.get(r.athlete_id) || 0) + 1);
    });
    return counts;
  }, [registeredAthletes]);

  // Categorías disponibles para filtro en pesaje
  const weighInCategoriesList = useMemo(() => {
    const set = new Set<string>();
    weighInAthletes.forEach((a) => {
      if (a.category_name) set.add(a.category_name);
    });
    return Array.from(set).sort();
  }, [weighInAthletes]);

  // Judokas filtrados en pesaje
  const filteredWeighInAthletes = useMemo(() => {
    return weighInAthletes.filter((ath) => {
      const matchesSearch =
        ath.name.toLowerCase().includes(weighInSearch.toLowerCase()) ||
        ath.rut_dni.toLowerCase().includes(weighInSearch.toLowerCase()) ||
        ath.club_name.toLowerCase().includes(weighInSearch.toLowerCase());
      const matchesCat =
        weighInCategoryFilter === 'ALL' || ath.category_name === weighInCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [weighInAthletes, weighInSearch, weighInCategoryFilter]);

  // Distribución de carga por tatami
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

  // Medallero por Clubes
  const clubMedalRanking: ClubMedalRow[] = useMemo(() => {
    const clubMap: Record<string, ClubMedalRow> = {};

    const registerMedal = (place: { club?: string } | null, type: 'gold' | 'silver' | 'bronze') => {
      if (!place || !place.club || place.club === '—') return;
      const clubName = place.club.trim();
      if (!clubMap[clubName]) {
        clubMap[clubName] = { club: clubName, gold: 0, silver: 0, bronze: 0, total: 0 };
      }
      clubMap[clubName][type] += 1;
      clubMap[clubName].total += 1;
    };

    for (const pr of podiumResults) {
      registerMedal(pr.podium.firstPlace, 'gold');
      registerMedal(pr.podium.secondPlace, 'silver');
      registerMedal(pr.podium.thirdPlaceA, 'bronze');
      registerMedal(pr.podium.thirdPlaceB, 'bronze');
    }

    return Object.values(clubMap).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      if (b.total !== a.total) return b.total - a.total;
      return a.club.localeCompare(b.club);
    });
  }, [podiumResults]);

  // ==========================================================================
  // MANEJADORES DE ACCIÓN
  // ==========================================================================

  const handleInjectBaseAthletes = async () => {
    try {
      const res = await injectAthletesToTournamentAction(tournament.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Se inyectaron ${res.count} judokas a este campeonato.`,
        });
        loadRoster();
        loadWeighIn();
        loadBrackets();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error al inyectar judokas.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado inyectando judokas.' });
    }
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
            valid ? 'PESO APROBADO' : 'PESO EXCEDIDO / DSQ'
          }).`,
        });
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error guardando peso.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado al guardar pesaje.' });
    } finally {
      setSavingWeightId(null);
    }
  };

  const handleReclassifyAthlete = async (athlete: WeighInAthlete, targetCategoryName: string) => {
    setSavingWeightId(athlete.registration_id);
    try {
      const currentWeight = parseFloat(
        weightInputs[athlete.registration_id] || String(athlete.actual_weight || 0)
      );
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
    } catch {
      setFeedback({ type: 'error', text: 'Error reclasificando judoka.' });
    } finally {
      setSavingWeightId(null);
    }
  };

  const handleGenerateBracket = async (category: CategoryBracketStatus) => {
    setIsGeneratingBrackets(true);
    try {
      const chosenFormat5 = preferredFormat5ByCategory[category.id] || 'DOUBLE_POOL_5';
      const res = await generateCategoryMatchesAction({
        categoryId: category.id,
        tatamiNumber: category.assigned_tatami_number || 1,
        tournamentId: tournament.id,
        preferredFormat5: chosenFormat5,
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
    } catch {
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
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error guardando modificaciones de la llave.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error guardando modificaciones de la llave.' });
    }
  };

  const handleReassignTatami = async (categoryId: string, newTatamiNumber: number) => {
    setIsReassigningTatami(true);
    try {
      const res = await reassignCategoryTatamiAction({
        categoryId,
        newTatamiNumber,
        tournamentId: tournament.id,
      });
      if (res.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId ? { ...c, assigned_tatami_number: newTatamiNumber } : c
          )
        );
        setFeedback({ type: 'success', text: res.message });
        await loadBrackets();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error al reasignar tatami.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al reasignar tatami.' });
    } finally {
      setIsReassigningTatami(false);
    }
  };

  const handleCreateCategory = async (params: {
    name: string;
    ageGroup: string;
    gender: 'M' | 'F' | 'MIXED';
    matchDurationSeconds: number;
  }) => {
    const res = await createTournamentCategoryAction({
      tournamentId: tournament.id,
      name: params.name,
      age_group: params.ageGroup,
      gender: params.gender,
      match_duration_seconds: params.matchDurationSeconds,
    });
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      await loadBrackets();
      if (reassigningAthlete && res.category?.id) {
        setReassignTargetCatId(res.category.id);
      }
    } else {
      setFeedback({ type: 'error', text: res.message || 'Error creando la categoría.' });
    }
  };

  const handleCopyPin = (slug: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleCopyAllPins = () => {
    const text = credentials
      .map((c) => `Tatami #${c.tatami_number} (${c.station_name}): PIN ${c.pin}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handlePrintCredentials = () => {
    window.print();
  };

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
        setFeedback({
          type: 'success',
          text: res.message || 'Judoka reasignado exitosamente.',
        });
        setReassigningAthlete(null);
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error reasignando judoka.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado al reasignar judoka.' });
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const handleAddAthleteToAdditionalCategory = async () => {
    if (!additionalCatAthlete || !additionalTargetCatId) return;
    setIsSubmittingAdditional(true);
    try {
      const res = await addAthleteToAdditionalCategoryAction({
        tournamentId: tournament.id,
        athleteId: additionalCatAthlete.athlete_id,
        targetCategoryId:
          additionalTargetCatId === '__custom__' ? undefined : additionalTargetCatId,
        targetCategoryName:
          additionalTargetCatId === '__custom__' ? additionalCustomCatName.trim() : undefined,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: res.message || '¡Judoka inscrito en categoría adicional!',
        });
        setAdditionalCatAthlete(null);
        setAdditionalTargetCatId('');
        setAdditionalCustomCatName('');
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error al inscribir en categoría adicional.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado al agregar categoría adicional.' });
    } finally {
      setIsSubmittingAdditional(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CABECERA PRINCIPAL DEL CAMPEONATO */}
      <header className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <Link
                href="/admin/tournaments"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Volver al Listado de Campeonatos"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>{tournament.name}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {tournament.status}
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
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

          {/* ACCIONES RÁPIDAS: INYECCIÓN DE PRUEBA */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleInjectBaseAthletes}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 shadow-lg flex-shrink-0 ${
                registeredAthletes.length === 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700'
              }`}
              title="Inyecta o actualiza una nómina de prueba para probar todos los formatos de sorteo"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>
                {registeredAthletes.length === 0
                  ? 'Inyectar Nómina de Prueba'
                  : 'Re-inyectar Nómina de Prueba'}
              </span>
            </button>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Judokas Inscritos
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
            onClick={() => handleTabChange('roster')}
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
            onClick={() => handleTabChange('weigh_in')}
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
            onClick={() => handleTabChange('brackets')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'brackets'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Sorteo y Llaves</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 flex-shrink-0 ${
              activeTab === 'credentials'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Tatamis y PINs</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('tatamis')}
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
            onClick={() => handleTabChange('results')}
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

      {/* CONTENIDO MODULAR POR PESTAÑA */}
      {activeTab === 'roster' && (
        <TournamentRosterTab
          tournament={tournament}
          categories={categories}
          registeredAthletes={registeredAthletes}
          loadingRoster={loadingRoster}
          onRefreshRoster={loadRoster}
          rosterSearch={rosterSearch}
          onRosterSearchChange={setRosterSearch}
          athleteRegistrationCounts={athleteRegistrationCounts}
          onOpenAdditionalCategoryModal={(ath) => {
            setAdditionalCatAthlete(ath);
            const otherCat = categories.find((c) => c.id !== ath.category_id);
            setAdditionalTargetCatId(otherCat ? otherCat.id : categories[0]?.id || '');
          }}
          onOpenReassignModal={(ath) => {
            setReassigningAthlete(ath);
            const otherCat = categories.find((c) => c.id !== ath.category_id);
            setReassignTargetCatId(
              otherCat ? otherCat.id : ath.category_id || categories[0]?.id || ''
            );
          }}
          onRegistrationsConfirmed={() => {
            loadRoster();
            loadWeighIn();
            loadBrackets();
          }}
        />
      )}

      {activeTab === 'weigh_in' && (
        <TournamentWeighInTab
          tournamentName={tournament.name}
          loadingWeighIn={loadingWeighIn}
          onRefreshWeighIn={loadWeighIn}
          weighInSearch={weighInSearch}
          onWeighInSearchChange={setWeighInSearch}
          weighInCategoryFilter={weighInCategoryFilter}
          onWeighInCategoryFilterChange={setWeighInCategoryFilter}
          weighInCategoriesList={weighInCategoriesList}
          filteredWeighInAthletes={filteredWeighInAthletes}
          weightInputs={weightInputs}
          onWeightInputChange={(regId, val) =>
            setWeightInputs((prev) => ({ ...prev, [regId]: val }))
          }
          savingWeightId={savingWeightId}
          onRecordWeight={handleRecordWeight}
          onReclassifyAthlete={handleReclassifyAthlete}
        />
      )}

      {activeTab === 'brackets' && (
        <TournamentBracketsTab
          tournament={tournament}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategoryId={setSelectedCategoryId}
          loadingBrackets={loadingBrackets}
          onRefreshBrackets={loadBrackets}
          onOpenNewCategoryModal={() => setIsNewCategoryModalOpen(true)}
          tatamiDistribution={tatamiDistribution}
          categoryBrackets={categoryBrackets}
          preferredFormat5ByCategory={preferredFormat5ByCategory}
          onSetPreferredFormat5={(catId, format) =>
            setPreferredFormat5ByCategory((prev) => ({ ...prev, [catId]: format }))
          }
          isReassigningTatami={isReassigningTatami}
          onReassignTatami={handleReassignTatami}
          isGeneratingBrackets={isGeneratingBrackets}
          onGenerateBracket={handleGenerateBracket}
          onSaveBracketModification={handleSaveBracketModification}
        />
      )}

      {activeTab === 'credentials' && (
        <TournamentCredentialsTab
          tournamentName={tournament.name}
          credentials={credentials}
          copiedSlug={copiedSlug}
          copiedAll={copiedAll}
          onCopyPin={handleCopyPin}
          onCopyAll={handleCopyAllPins}
          onPrint={handlePrintCredentials}
        />
      )}

      {activeTab === 'tatamis' && (
        <TournamentTatamisTab
          tournamentId={tournament.id}
          tournamentName={tournament.name}
        />
      )}

      {activeTab === 'results' && (
        <TournamentResultsTab
          tournamentName={tournament.name}
          podiumResults={podiumResults}
          clubMedalRanking={clubMedalRanking}
          loadingPodiums={loadingPodiums}
          onRefreshPodiums={loadPodiums}
        />
      )}

      {/* MODALES */}
      <ReassignCategoryModal
        athlete={reassigningAthlete}
        categories={categories}
        targetCatId={reassignTargetCatId}
        onTargetCatIdChange={setReassignTargetCatId}
        isSubmitting={isSubmittingReassign}
        onConfirm={handleReassignAthleteCategory}
        onClose={() => setReassigningAthlete(null)}
        onOpenNewCategory={() => setIsNewCategoryModalOpen(true)}
      />

      <AdditionalCategoryModal
        athlete={additionalCatAthlete}
        categories={categories}
        targetCatId={additionalTargetCatId}
        onTargetCatIdChange={setAdditionalTargetCatId}
        customCatName={additionalCustomCatName}
        onCustomCatNameChange={setAdditionalCustomCatName}
        isSubmitting={isSubmittingAdditional}
        onConfirm={handleAddAthleteToAdditionalCategory}
        onClose={() => setAdditionalCatAthlete(null)}
      />

      <NewCategoryModal
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        onSubmit={handleCreateCategory}
      />
    </div>
  );
}
