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
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Trophy,
  Users,
  Scale,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  TournamentItem,
  setActiveTournamentAction,
} from '@/app/actions/tournaments';
import {
  getTournamentRegistrationsAction,
  RegisteredAthleteSummary,
  reassignAthleteCategoryAction,
  addAthleteToAdditionalCategoryAction,
  removeAthleteFromCategoryAction,
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
  rebalanceTournamentTatamisAction,
  createTournamentCategoryAction,
  deleteTournamentCategoryAction,
  getTournamentPodiumsAction,
  updateCategoryMatchDurationAction,
  CategoryPodiumResult,
} from '@/app/actions/brackets';
import {
  getTournamentCredentialsAction,
  TatamiCredential,
} from '@/app/actions/tournament-builder';
import { BracketResult } from '@/lib/rules/bracket-engine';
import {
  isWeightValidForCategory,
  sortCategoryNames,
  sortCategories,
  compareJudoCategories,
} from '@/lib/rules/judo-categories';

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
  const router = useRouter();
  const pathname = usePathname();
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

  // Sincronización reactiva inmediata cuando cambia la pestaña en la URL (ej: clics en Menú Lateral)
  useEffect(() => {
    if (!requestedTab || requestedTab === 'roster') {
      setActiveTab('roster');
    } else if (requestedTab === 'tatamis' || requestedTab === 'monitor') {
      setActiveTab('tatamis');
    } else if (requestedTab === 'weigh_in') {
      setActiveTab('weigh_in');
    } else if (requestedTab === 'brackets') {
      setActiveTab('brackets');
    } else if (requestedTab === 'credentials') {
      setActiveTab('credentials');
    } else if (requestedTab === 'results') {
      setActiveTab('results');
    }
  }, [requestedTab]);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Manejo de cambio de pestaña con actualización en URL
  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
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
  const [isRebalancingTatamis, setIsRebalancingTatamis] = useState(false);
  const [isUpdatingCategoryDuration, setIsUpdatingCategoryDuration] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [preferredFormat5ByCategory, setPreferredFormat5ByCategory] = useState<
    Record<string, 'ROUND_ROBIN' | 'DOUBLE_POOL_5'>
  >({});

  // ==========================================================================
  // ESTADOS DE PESTAÑA 4: CREDENCIALES PIN
  // ==========================================================================
  const [credentials, setCredentials] = useState<TatamiCredential[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

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
  const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);
  const [isMutatingCategoryAthlete, setIsMutatingCategoryAthlete] = useState(false);

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
        const sortedCats = sortCategories(res.categories);
        setCategories(sortedCats);
        if (!selectedCategoryId && sortedCats.length > 0) {
          setSelectedCategoryId(sortedCats[0].id);
        }
      }
    } finally {
      setLoadingBrackets(false);
    }
  }, [tournament.id, selectedCategoryId]);

  const loadCategoryBracket = useCallback(
    async (catId: string) => {
      try {
        const res = await getCategoryBracketAction(catId, tournament.id);
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
        const sortedResults = [...res.results].sort((a, b) =>
          compareJudoCategories({ name: a.categoryName }, { name: b.categoryName })
        );
        setPodiumResults(sortedResults);
      }
    } finally {
      setLoadingPodiums(false);
    }
  }, [tournament.id]);

  // Sincronización al montar y al cambiar de pestaña
  useEffect(() => {
    if (activeTab === 'roster') {
      loadRoster();
      loadBrackets();
    }
    if (activeTab === 'weigh_in') loadWeighIn();
    if (activeTab === 'brackets') {
      loadBrackets();
      loadRoster();
    }
    if (activeTab === 'credentials') loadCredentials();
    if (activeTab === 'results') loadPodiums();
  }, [activeTab, loadRoster, loadWeighIn, loadBrackets, loadCredentials, loadPodiums]);

  // Cargar llave de la categoría activa
  useEffect(() => {
    if (selectedCategoryId && activeTab === 'brackets') {
      loadCategoryBracket(selectedCategoryId);
    }
  }, [selectedCategoryId, activeTab, loadCategoryBracket]);

  // Conteo de inscripciones y competidores únicos
  const athleteRegistrationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    registeredAthletes.forEach((r) => {
      counts.set(r.athlete_id, (counts.get(r.athlete_id) || 0) + 1);
    });
    return counts;
  }, [registeredAthletes]);

  const uniqueRegisteredAthletesCount = useMemo(() => {
    return new Set(registeredAthletes.map((r) => r.athlete_id || r.id)).size;
  }, [registeredAthletes]);

  const uniqueWeighInStats = useMemo(() => {
    const byAthlete = new Map<string, WeighInAthlete[]>();
    weighInAthletes.forEach((a) => {
      const key = a.athlete_id || a.registration_id;
      const list = byAthlete.get(key) || [];
      list.push(a);
      byAthlete.set(key, list);
    });
    let passedCount = 0;
    byAthlete.forEach((regs) => {
      if (regs.some((r) => r.weigh_in_status === 'PASSED')) {
        passedCount += 1;
      }
    });
    return { total: byAthlete.size, passed: passedCount };
  }, [weighInAthletes]);

  // Categorías disponibles para filtro en pesaje
  const weighInCategoriesList = useMemo(() => {
    const set = new Set<string>();
    weighInAthletes.forEach((a) => {
      if (a.category_name) set.add(a.category_name);
    });
    return sortCategoryNames(Array.from(set));
  }, [weighInAthletes]);

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

  const handleRecordWeight = async (athlete: WeighInAthlete, explicitWeight?: number) => {
    const rawVal =
      weightInputs[athlete.athlete_id] ??
      weightInputs[athlete.registration_id];
    const weightNum =
      explicitWeight !== undefined && !isNaN(explicitWeight) && explicitWeight > 0
        ? explicitWeight
        : parseFloat(rawVal ?? String(athlete.actual_weight || ''));

    if (isNaN(weightNum) || weightNum <= 0) {
      setFeedback({ type: 'error', text: 'Ingresa un peso numérico válido en kg.' });
      return;
    }

    const { valid } = isWeightValidForCategory(weightNum, athlete.category_name);
    const newStatus: WeighInAthlete['weigh_in_status'] = valid ? 'PASSED' : 'DSQ';

    const saveKey = athlete.athlete_id || athlete.registration_id;
    setSavingWeightId(saveKey);
    try {
      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: weightNum,
        status: newStatus,
        tournamentId: tournament.id,
      });

      if (res.success) {
        const updatedMap = new Map(
          (res.updatedRegistrations || []).map((u) => [u.registration_id, u])
        );
        const nowIso = new Date().toISOString();

        setWeighInAthletes((prev) =>
          prev.map((a) => {
            const updated = updatedMap.get(a.registration_id);
            if (updated) {
              return {
                ...a,
                actual_weight: updated.actual_weight,
                weigh_in_status: updated.weigh_in_status,
                weigh_in_at: nowIso,
              };
            }
            if (a.registration_id === athlete.registration_id || (athlete.athlete_id && a.athlete_id === athlete.athlete_id)) {
              const check = isWeightValidForCategory(weightNum, a.category_name);
              return {
                ...a,
                actual_weight: weightNum,
                weigh_in_status: check.valid ? 'PASSED' : 'DSQ',
                weigh_in_at: nowIso,
              };
            }
            return a;
          })
        );

        const anyPassed = res.updatedRegistrations
          ? res.updatedRegistrations.some((u) => u.weigh_in_status === 'PASSED')
          : valid;

        setFeedback({
          type: anyPassed ? 'success' : 'info',
          text: res.message,
        });
        loadBrackets();
        loadRoster();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error guardando peso.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado al guardar pesaje.' });
    } finally {
      setSavingWeightId(null);
    }
  };

  const handleReclassifyAthlete = async (
    athlete: WeighInAthlete,
    targetCategoryName: string,
    explicitWeight?: number
  ) => {
    const saveKey = athlete.athlete_id || athlete.registration_id;
    setSavingWeightId(saveKey);
    try {
      const rawVal =
        weightInputs[athlete.athlete_id] ??
        weightInputs[athlete.registration_id];
      const currentWeight =
        explicitWeight !== undefined && !isNaN(explicitWeight) && explicitWeight > 0
          ? explicitWeight
          : parseFloat(rawVal || String(athlete.actual_weight || 0));

      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: currentWeight,
        status: 'PASSED',
        newCategoryName: targetCategoryName,
        tournamentId: tournament.id,
      });

      if (res.success) {
        const updatedMap = new Map(
          (res.updatedRegistrations || []).map((u) => [u.registration_id, u])
        );
        const nowIso = new Date().toISOString();

        setWeighInAthletes((prev) =>
          prev.map((a) => {
            if (a.registration_id === athlete.registration_id) {
              return {
                ...a,
                category_name: targetCategoryName,
                weigh_in_status: 'PASSED',
                actual_weight: currentWeight,
                weigh_in_at: nowIso,
              };
            }
            const updated = updatedMap.get(a.registration_id);
            if (updated) {
              return {
                ...a,
                actual_weight: updated.actual_weight,
                weigh_in_status: updated.weigh_in_status,
                weigh_in_at: nowIso,
              };
            }
            return a;
          })
        );
        setFeedback({
          type: 'success',
          text: `${athlete.name} reclasificado exitosamente a ${targetCategoryName}.`,
        });
        loadBrackets();
        loadRoster();
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

  const handleRebalanceTatamis = async () => {
    setIsRebalancingTatamis(true);
    try {
      const res = await rebalanceTournamentTatamisAction({
        tournamentId: tournament.id,
      });
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
        await loadBrackets();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Error al rebalancear tatamis.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al rebalancear tatamis.' });
    } finally {
      setIsRebalancingTatamis(false);
    }
  };

  const handleUpdateCategoryDuration = async (categoryId: string, durationSeconds: number) => {
    setIsUpdatingCategoryDuration(true);
    try {
      const res = await updateCategoryMatchDurationAction({
        categoryId,
        durationSeconds,
      });
      if (res.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId ? { ...c, match_duration_seconds: durationSeconds } : c
          )
        );
        setFeedback({ type: 'success', text: res.message || 'Duración de la categoría actualizada.' });
        await loadBrackets();
      } else {
        setFeedback({ type: 'error', text: res.message || res.error || 'Error al actualizar duración.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al actualizar duración.' });
    } finally {
      setIsUpdatingCategoryDuration(false);
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

  const tatamiSummary = useMemo(() => {
    const summary: Record<number, { categoriesCount: number; athletesCount: number; categoryNames: string[] }> = {};
    const tatamiCount = tournament.tatami_count || 1;
    for (let t = 1; t <= tatamiCount; t++) {
      summary[t] = { categoriesCount: 0, athletesCount: 0, categoryNames: [] };
    }
    categories.forEach((cat) => {
      const tNum = cat.assigned_tatami_number || 1;
      if (!summary[tNum]) {
        summary[tNum] = { categoriesCount: 0, athletesCount: 0, categoryNames: [] };
      }
      summary[tNum].categoriesCount++;
      summary[tNum].categoryNames.push(cat.name);
      const athCount = registeredAthletes.filter((a) => a.category_id === cat.id).length;
      summary[tNum].athletesCount += athCount;
    });
    return summary;
  }, [categories, registeredAthletes, tournament.tatami_count]);

  const handleCopyPin = (slug: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
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
        targetCategoryId: additionalTargetCatId,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: res.message || '¡Judoka inscrito en categoría adicional!',
        });
        setAdditionalCatAthlete(null);
        setAdditionalTargetCatId('');
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

  const handleAddAthleteDirectToCategory = async (athleteId: string, categoryId: string) => {
    setIsMutatingCategoryAthlete(true);
    try {
      const res = await addAthleteToAdditionalCategoryAction({
        tournamentId: tournament.id,
        athleteId,
        targetCategoryId: categoryId,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: res.message || '¡Judoka agregado a la categoría!',
        });
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error al agregar judoka a la categoría.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado al agregar judoka a la categoría.' });
    } finally {
      setIsMutatingCategoryAthlete(false);
    }
  };

  const handleRemoveAthleteRegistration = async (reg: RegisteredAthleteSummary) => {
    setIsMutatingCategoryAthlete(true);
    try {
      const res = await removeAthleteFromCategoryAction({
        registrationId: reg.id,
        tournamentId: tournament.id,
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `${reg.name} fue quitado de "${reg.category_name}".`,
        });
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Error al quitar judoka de la categoría.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado quitando inscripción.' });
    } finally {
      setIsMutatingCategoryAthlete(false);
    }
  };

  const handleDeleteCategory = async (category: CategoryBracketStatus) => {
    setIsMutatingCategoryAthlete(true);
    try {
      const res = await deleteTournamentCategoryAction({
        categoryId: category.id,
        tournamentId: tournament.id,
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Categoría "${category.name}" eliminada correctamente.`,
        });
        const remaining = categories.filter((c) => c.id !== category.id);
        setSelectedCategoryId(remaining[0]?.id || null);
        await Promise.all([loadRoster(), loadWeighIn(), loadBrackets()]);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'No se pudo eliminar la categoría.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error inesperado eliminando categoría.' });
    } finally {
      setIsMutatingCategoryAthlete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CABECERA PRINCIPAL DEL CAMPEONATO */}
      <header className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 print:hidden">
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
        </div>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              Judokas Inscritos
            </span>
            <span className="text-xl font-black text-emerald-400 mt-0.5 block">
              {uniqueRegisteredAthletesCount}
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
              {uniqueWeighInStats.passed} / {uniqueWeighInStats.total}
            </span>
          </div>
        </div>

      </header>

      {/* FEEDBACK GLOBAL */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold print:hidden ${
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
            const enrolledIds = new Set(
              registeredAthletes
                .filter((r) => r.athlete_id === ath.athlete_id)
                .map((r) => r.category_id)
            );
            const otherCat = categories.find((c) => !enrolledIds.has(c.id));
            setAdditionalTargetCatId(otherCat ? otherCat.id : '');
          }}
          onOpenReassignModal={(ath) => {
            setReassigningAthlete(ath);
            const otherCat = categories.find((c) => c.id !== ath.category_id);
            setReassignTargetCatId(
              otherCat ? otherCat.id : ath.category_id || categories[0]?.id || ''
            );
          }}
          onRemoveRegistration={(reg) => {
            if (
              window.confirm(
                `¿Quitar a ${reg.name} de la categoría "${reg.category_name}"?`
              )
            ) {
              handleRemoveAthleteRegistration(reg);
            }
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
          weighInAthletes={weighInAthletes}
          weightInputs={weightInputs}
          onWeightInputChange={(athleteKey, val) =>
            setWeightInputs((prev) => ({ ...prev, [athleteKey]: val }))
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
          isRebalancingTatamis={isRebalancingTatamis}
          onRebalanceTatamis={handleRebalanceTatamis}
          isUpdatingCategoryDuration={isUpdatingCategoryDuration}
          onUpdateCategoryDuration={handleUpdateCategoryDuration}
          isGeneratingBrackets={isGeneratingBrackets}
          onGenerateBracket={handleGenerateBracket}
          onSaveBracketModification={handleSaveBracketModification}
          registeredAthletes={registeredAthletes}
          onAddAthleteToCategory={handleAddAthleteDirectToCategory}
          onRemoveAthleteFromCategory={handleRemoveAthleteRegistration}
          onDeleteCategory={handleDeleteCategory}
          isMutatingCategoryAthlete={isMutatingCategoryAthlete}
        />
      )}

      {activeTab === 'credentials' && (
        <TournamentCredentialsTab
          tournamentName={tournament.name}
          credentials={credentials}
          tatamiSummary={tatamiSummary}
          copiedSlug={copiedSlug}
          onCopyPin={handleCopyPin}
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
        alreadyRegisteredCategoryIds={
          additionalCatAthlete
            ? registeredAthletes
                .filter((r) => r.athlete_id === additionalCatAthlete.athlete_id)
                .map((r) => r.category_id)
            : []
        }
        targetCatId={additionalTargetCatId}
        onTargetCatIdChange={setAdditionalTargetCatId}
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
