'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Swords,
  RefreshCw,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  ArrowRight,
  FileDown,
} from 'lucide-react';
import { BracketViewer } from '@/components/admin/bracket-viewer';
import { downloadElementAsPdf, downloadMultiplePagesAsPdf } from '@/lib/utils/pdf-downloader';
import { CategoryBracketStatus } from '@/app/actions/brackets';
import { RegisteredAthleteSummary } from '@/app/actions/registrations';
import { BracketResult, generateCategoryBracket } from '@/lib/rules/bracket-engine';
import { sortCategories } from '@/lib/rules/judo-categories';

interface TatamiDistItem {
  tatamiNum: number;
  categoriesCount: number;
  athletesCount: number;
}

type CategoryStatusFilter = 'ALL' | 'READY' | 'GENERATED' | 'PENDING';

interface TournamentBracketsTabProps {
  tournament: {
    id: string;
    name: string;
    tatami_count?: number;
  };
  categories: CategoryBracketStatus[];
  selectedCategoryId: string | null;
  onSelectCategoryId: (id: string) => void;
  loadingBrackets: boolean;
  onRefreshBrackets: () => void;
  onOpenNewCategoryModal: () => void;
  tatamiDistribution: TatamiDistItem[];
  categoryBrackets: Record<string, BracketResult>;
  preferredFormat5ByCategory: Record<string, 'ROUND_ROBIN' | 'DOUBLE_POOL_5'>;
  onSetPreferredFormat5: (categoryId: string, format: 'ROUND_ROBIN' | 'DOUBLE_POOL_5') => void;
  isReassigningTatami: boolean;
  onReassignTatami: (categoryId: string, tatamiNum: number) => void;
  isUpdatingCategoryDuration?: boolean;
  onUpdateCategoryDuration?: (categoryId: string, durationSeconds: number) => void;
  isGeneratingBrackets: boolean;
  onGenerateBracket: (category: CategoryBracketStatus) => void;
  onSaveBracketModification: (bracket: BracketResult) => Promise<void> | void;
  registeredAthletes?: RegisteredAthleteSummary[];
  onAddAthleteToCategory?: (athleteId: string, categoryId: string) => Promise<void> | void;
  onRemoveAthleteFromCategory?: (registration: RegisteredAthleteSummary) => Promise<void> | void;
  onDeleteCategory?: (category: CategoryBracketStatus) => Promise<void> | void;
  isMutatingCategoryAthlete?: boolean;
}

export function TournamentBracketsTab({
  tournament,
  categories,
  selectedCategoryId,
  onSelectCategoryId,
  loadingBrackets,
  onRefreshBrackets,
  onOpenNewCategoryModal,
  tatamiDistribution,
  categoryBrackets,
  preferredFormat5ByCategory,
  onSetPreferredFormat5,
  isReassigningTatami,
  onReassignTatami,
  isUpdatingCategoryDuration = false,
  onUpdateCategoryDuration,
  isGeneratingBrackets,
  onGenerateBracket,
  onSaveBracketModification,
  registeredAthletes = [],
  onAddAthleteToCategory,
  onRemoveAthleteFromCategory,
  onDeleteCategory,
  isMutatingCategoryAthlete = false,
}: TournamentBracketsTabProps) {
  const [categorySearch, setCategorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>('ALL');
  const [tatamiFilter, setTatamiFilter] = useState<number | 'ALL'>('ALL');

  const [showAddAthletePanel, setShowAddAthletePanel] = useState(false);
  const [addAthleteSearch, setAddAthleteSearch] = useState('');

  // 1. Ordenar categorías canónicamente según estructura IJF (División -> Género -> Peso numérico)
  const orderedCategories = useMemo(() => {
    return sortCategories(categories);
  }, [categories]);

  // Contadores de filtros rápidos
  const filterCounts = useMemo(() => {
    const ready = orderedCategories.filter(
      (c) => !c.matches_generated && c.passed_weigh_in >= 1
    ).length;
    const generated = orderedCategories.filter((c) => c.matches_generated).length;
    const pending = orderedCategories.filter(
      (c) => !c.matches_generated && c.passed_weigh_in === 0
    ).length;
    return {
      all: orderedCategories.length,
      ready,
      generated,
      pending,
    };
  }, [orderedCategories]);

  // 2. Aplicar buscador + filtro de estado + filtro de tatami
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return orderedCategories.filter((cat) => {
      if (q) {
        const tatamiLabel = `tatami ${cat.assigned_tatami_number}`;
        const matchesQuery =
          cat.name.toLowerCase().includes(q) ||
          cat.age_group?.toLowerCase().includes(q) ||
          tatamiLabel.includes(q);
        if (!matchesQuery) return false;
      }

      if (tatamiFilter !== 'ALL' && cat.assigned_tatami_number !== tatamiFilter) {
        return false;
      }

      if (statusFilter === 'READY') {
        return !cat.matches_generated && cat.passed_weigh_in >= 1;
      }
      if (statusFilter === 'GENERATED') {
        return cat.matches_generated;
      }
      if (statusFilter === 'PENDING') {
        return !cat.matches_generated && cat.passed_weigh_in === 0;
      }
      return true;
    });
  }, [orderedCategories, categorySearch, tatamiFilter, statusFilter]);

  // Categoría activa (si la seleccionada fue filtrada fuera, usar la primera de la lista visible o fallback)
  const activeCategory = useMemo(() => {
    return (
      filteredCategories.find((c) => c.id === selectedCategoryId) ||
      orderedCategories.find((c) => c.id === selectedCategoryId) ||
      filteredCategories[0] ||
      orderedCategories[0] ||
      null
    );
  }, [filteredCategories, orderedCategories, selectedCategoryId]);

  const navList = filteredCategories.length > 0 ? filteredCategories : orderedCategories;
  const activeIndex = activeCategory
    ? navList.findIndex((c) => c.id === activeCategory.id)
    : -1;
  const prevCategory = activeIndex > 0 ? navList[activeIndex - 1] : null;
  const nextCategory =
    activeIndex >= 0 && activeIndex < navList.length - 1 ? navList[activeIndex + 1] : null;

  const nextUngeneratedCategory = useMemo(() => {
    if (!activeCategory) return null;
    // Solo elegible si no está sorteada Y tiene al menos 1 judoka con pesaje aprobado
    const isEligible = (c: CategoryBracketStatus) =>
      !c.matches_generated && (c.passed_weigh_in || 0) > 0;
    const afterCurrent = navList.slice(Math.max(0, activeIndex + 1)).find(isEligible);
    if (afterCurrent) return afterCurrent;
    return navList.find((c) => isEligible(c) && c.id !== activeCategory.id) || null;
  }, [navList, activeIndex, activeCategory]);

  // 3. Judokas inscritos en la categoría activa + candidatos disponibles del torneo
  const categoryRegistrations = useMemo(() => {
    if (!activeCategory) return [];
    return registeredAthletes.filter((r) => r.category_id === activeCategory.id);
  }, [registeredAthletes, activeCategory]);

  const availableAthletesToAdd = useMemo(() => {
    if (!activeCategory) return [];
    const enrolledAthleteIds = new Set(categoryRegistrations.map((r) => r.athlete_id));
    const uniqueCandidates = new Map<string, RegisteredAthleteSummary>();

    registeredAthletes.forEach((reg) => {
      if (!enrolledAthleteIds.has(reg.athlete_id) && !uniqueCandidates.has(reg.athlete_id)) {
        uniqueCandidates.set(reg.athlete_id, reg);
      }
    });

    const q = addAthleteSearch.trim().toLowerCase();
    const list = Array.from(uniqueCandidates.values());
    if (!q) return list.slice(0, 15);

    return list
      .filter(
        (ath) =>
          ath.name.toLowerCase().includes(q) ||
          ath.rut_dni.toLowerCase().includes(q) ||
          ath.club_name.toLowerCase().includes(q) ||
          ath.category_name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [registeredAthletes, categoryRegistrations, activeCategory, addAthleteSearch]);

  const handleSelectCategory = (id: string) => {
    onSelectCategoryId(id);
    setShowAddAthletePanel(false);
    setAddAthleteSearch('');
  };

  const weighedCategories = useMemo(() => {
    return orderedCategories.filter(
      (c) => c.passed_weigh_in >= 1 || c.matches_generated
    );
  }, [orderedCategories]);

  const totalWeighedAthletes = useMemo(() => {
    return (registeredAthletes || []).filter(
      (a) => a.weigh_in_status === 'PASSED' || a.actual_weight !== null
    ).length;
  }, [registeredAthletes]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportWeighedPdf = async () => {
    const el = document.getElementById('printable-brackets-container');
    if (!el) return;
    setIsExportingPdf(true);
    try {
      // Obtener cada hoja oficial de categoría (.official-bracket-page)
      // para exportar página por página sin cortes de hoja ni franjas negras
      const pages = Array.from(el.querySelectorAll<HTMLElement>('.official-bracket-page'));

      if (pages.length > 0) {
        await downloadMultiplePagesAsPdf(pages, {
          filename: `Llaves_Oficiales_${tournament.name.replace(/[\s/\\:]+/g, '_')}`,
          orientation: 'landscape',
          backgroundColor: '#0f172a',
          fitToPage: true,
        });
      }
    } catch (err) {
      console.error('Error generando PDF de llaves:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* SECCIÓN INTERACTIVA DE PANTALLA (OCULTA AL IMPRIMIR) */}
      <div className="space-y-5 print:hidden">
        {/* CABECERA GLOBAL DE SORTEO Y BALANCEO DE TATAMIS */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Sorteo - {tournament.name}</span>
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                  {filterCounts.generated}/{filterCounts.all} sorteadas
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Busca y selecciona una categoría en el panel izquierdo para gestionar competidores, asignar tatami o generar su llave.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportWeighedPdf}
                disabled={weighedCategories.length === 0 || isExportingPdf}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border shadow ${
                  weighedCategories.length > 0 && !isExportingPdf
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40 hover:border-amber-400 cursor-pointer'
                    : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                }`}
                title="Descargar en PDF las hojas oficiales de todas las categorías con judokas pesados"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Generando PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Exportar PDF ({weighedCategories.length} Pesadas)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenNewCategoryModal}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Nueva Categoría</span>
              </button>
              <button
                type="button"
                onClick={onRefreshBrackets}
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
                  {t.categoriesCount} cat. ({t.athletesCount} judokas)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {categories.length === 0 ? (
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center space-y-2 text-slate-500 shadow-xl">
          <Trophy className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-bold">No hay categorías configuradas en este campeonato.</p>
          <p className="text-xs">
            Inscribe judokas en la pestaña de Inscripciones o crea una categoría para comenzar.
          </p>
        </section>
      ) : (
        /* VISTA MAESTRO–DETALLE LATERAL (OPCIÓN A) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============================================================== */}
          {/* PANEL IZQUIERDO: BUSCADOR, FILTROS Y LISTA DE CATEGORÍAS       */}
          {/* ============================================================== */}
          <aside className="lg:col-span-4 xl:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 lg:sticky lg:top-4">
            {/* Buscador de Categorías */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar categoría (ej: Sub-18, -73kg)..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtros por Estado */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL' as const, label: `Todas (${filterCounts.all})` },
                { key: 'READY' as const, label: `Listas (${filterCounts.ready})` },
                { key: 'GENERATED' as const, label: `Sorteadas (${filterCounts.generated})` },
                { key: 'PENDING' as const, label: `Pendientes (${filterCounts.pending})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border ${
                    statusFilter === f.key
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Filtro por Tatami */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTatamiFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 transition ${
                  tatamiFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-950 text-slate-500 hover:text-slate-300'
                }`}
              >
                Todos Tatamis
              </button>
              {Array.from({ length: tournament.tatami_count || 2 }, (_, i) => i + 1).map((tNum) => (
                <button
                  key={tNum}
                  type="button"
                  onClick={() => setTatamiFilter(tNum)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 transition ${
                    tatamiFilter === tNum
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-slate-950 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  T{tNum}
                </button>
              ))}
            </div>

            {/* Lista Scrolleable de Categorías */}
            <div className="max-h-[620px] overflow-y-auto space-y-2 pr-1">
              {filteredCategories.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                  No se encontraron categorías con esos filtros.
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  const isSelected = cat.id === activeCategory?.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`w-full p-3 rounded-xl border text-left transition space-y-1.5 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Tatami {cat.assigned_tatami_number}
                        </span>
                        {cat.bracket_type === 'UNCONTESTED' && cat.matches_generated ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Campeón Declarado
                          </span>
                        ) : cat.matches_generated ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Sorteada
                          </span>
                        ) : cat.passed_weigh_in >= 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-950 text-blue-400 border border-blue-800">
                            Lista p/ Sortear
                          </span>
                        ) : cat.total_registered === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-900 text-slate-500 border border-slate-800">
                            Vacía
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-950 text-amber-400 border border-amber-800">
                            Pesaje Pendiente
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-white leading-snug">{cat.name}</h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70">
                        <span className={cat.passed_weigh_in > 0 ? 'text-emerald-400 font-bold' : ''}>
                          {cat.passed_weigh_in} / {cat.total_registered} pesados
                        </span>
                        <span className="font-mono text-[10px] text-amber-400">
                          {cat.bracket_type === 'ROUND_ROBIN'
                            ? 'Round Robin'
                            : cat.bracket_type === 'BEST_OF_3'
                            ? 'Mejor de 3'
                            : cat.bracket_type === 'DOUBLE_POOL_5'
                            ? 'Pool Doble'
                            : cat.bracket_type === 'UNCONTESTED'
                            ? 'Campeón Directo'
                            : cat.bracket_type === 'INSUFFICIENT'
                            ? 'Sin pesados'
                            : 'Eliminación'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ============================================================== */}
          {/* PANEL DERECHO: DETALLE DE CATEGORÍA, PARTICIPANTES Y LLAVE     */}
          {/* ============================================================== */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {activeCategory && (
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                {/* BARRA DE NAVEGACIÓN SECUENCIAL DE CATEGORÍAS */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 bg-slate-950/60 -mx-2 px-3 py-2 rounded-xl">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-mono font-bold text-slate-400">
                      Categoría {activeIndex >= 0 ? activeIndex + 1 : 1} de {navList.length}
                    </span>
                    {nextUngeneratedCategory && (
                      <button
                        type="button"
                        onClick={() => handleSelectCategory(nextUngeneratedCategory.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800/80 text-[11px] font-bold transition flex items-center space-x-1"
                        title={`Saltar a: ${nextUngeneratedCategory.name} (${nextUngeneratedCategory.passed_weigh_in} pesado${nextUngeneratedCategory.passed_weigh_in === 1 ? '' : 's'})`}
                      >
                        <span>Próxima sin sortear</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={!prevCategory}
                      onClick={() => prevCategory && handleSelectCategory(prevCategory.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>

                    <button
                      type="button"
                      disabled={!nextCategory}
                      onClick={() => nextCategory && handleSelectCategory(nextCategory.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center space-x-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                      title={nextCategory ? `Avanzar a ${nextCategory.name}` : 'Última categoría de la lista'}
                    >
                      <span>Siguiente Categoría</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CABECERA DE LA CATEGORÍA Y ACCIONES */}
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">{activeCategory.name}</h3>
                      <span className="text-xs text-amber-400 font-mono bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                        Tatami #{activeCategory.assigned_tatami_number}
                      </span>
                      {onDeleteCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Seguro que deseas eliminar la categoría "${activeCategory.name}" y sus inscripciones pendientes de este campeonato?`
                              )
                            ) {
                              onDeleteCategory(activeCategory);
                            }
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 text-[11px] font-bold transition inline-flex items-center space-x-1"
                          title="Eliminar esta categoría del torneo"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>

                    {/* SELECTOR RÁPIDO DE REASIGNACIÓN DE TATAMI */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Reasignar Tatami:</span>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: tournament.tatami_count || 2 }, (_, i) => i + 1).map(
                          (tNum) => (
                            <button
                              key={tNum}
                              type="button"
                              onClick={() => onReassignTatami(activeCategory.id, tNum)}
                              disabled={
                                isReassigningTatami || activeCategory.assigned_tatami_number === tNum
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                activeCategory.assigned_tatami_number === tNum
                                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                              } ${isReassigningTatami ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Tatami {tNum}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* SELECTOR DE DURACIÓN DE COMBATES PARA TODA LA CATEGORÍA (DIRECTOR) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Duración Categoría:</span>
                      <div className="flex items-center space-x-1">
                        {[
                          { label: '2 min', sec: 120 },
                          { label: '3 min', sec: 180 },
                          { label: '4 min', sec: 240 },
                          { label: '5 min', sec: 300 },
                        ].map((preset) => {
                          const isSelected =
                            (activeCategory.match_duration_seconds || 240) === preset.sec;
                          return (
                            <button
                              key={preset.sec}
                              type="button"
                              onClick={() =>
                                onUpdateCategoryDuration &&
                                onUpdateCategoryDuration(activeCategory.id, preset.sec)
                              }
                              disabled={isUpdatingCategoryDuration || isSelected}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                              } ${isUpdatingCategoryDuration ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={`Fijar ${preset.label} para todos los combates de ${activeCategory.name}`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400">
                      Tipo de Cruce:{' '}
                      <strong className="text-white">
                        {activeCategory.passed_weigh_in === 5
                          ? preferredFormat5ByCategory[activeCategory.id] === 'ROUND_ROBIN'
                            ? 'Todos contra Todos (Round Robin)'
                            : 'Pool Doble'
                          : activeCategory.bracket_type === 'ROUND_ROBIN'
                          ? 'Todos contra Todos (Round Robin)'
                          : activeCategory.bracket_type === 'DOUBLE_POOL_5'
                          ? 'Pool Doble'
                          : activeCategory.bracket_type === 'BEST_OF_3'
                          ? 'Al Mejor de 3'
                          : activeCategory.bracket_type === 'UNCONTESTED'
                          ? 'Campeón Directo (Sin Competidor)'
                          : activeCategory.bracket_type === 'INSUFFICIENT'
                          ? 'Sin judokas pesados aún'
                          : 'Eliminación Simple'}
                      </strong>
                    </p>

                    {activeCategory.passed_weigh_in === 5 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 font-bold">Modalidad 5 Judokas:</span>
                        <button
                          type="button"
                          onClick={() => onSetPreferredFormat5(activeCategory.id, 'DOUBLE_POOL_5')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                            (preferredFormat5ByCategory[activeCategory.id] || 'DOUBLE_POOL_5') ===
                            'DOUBLE_POOL_5'
                              ? 'bg-amber-500 text-slate-950 font-black shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          Pool Doble
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetPreferredFormat5(activeCategory.id, 'ROUND_ROBIN')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                            preferredFormat5ByCategory[activeCategory.id] === 'ROUND_ROBIN'
                              ? 'bg-amber-500 text-slate-950 font-black shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          Todos contra Todos
                        </button>
                      </div>
                    )}
                  </div>

                  {/* BOTONES PRINCIPALES DE SORTEO Y COLA */}
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onGenerateBracket(activeCategory)}
                      disabled={isGeneratingBrackets || activeCategory.passed_weigh_in < 1}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center space-x-2 ${
                        activeCategory.passed_weigh_in < 1
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
                          : activeCategory.passed_weigh_in === 1
                          ? 'Declarar Campeón'
                          : 'Generar Llave'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* SECCIÓN DE COMPETIDORES DENTRO DE LA CATEGORÍA                 */}
                {/* ============================================================== */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Competidores en esta categoría ({categoryRegistrations.length})
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        • {activeCategory.passed_weigh_in} aprobados en pesaje
                      </span>
                    </div>

                    {onAddAthleteToCategory && (
                      <button
                        type="button"
                        onClick={() => setShowAddAthletePanel((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          {showAddAthletePanel
                            ? 'Cerrar Buscador de Judokas'
                            : '+ Agregar Judoka a esta Categoría'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Aviso si ya hay llave generada */}
                  {activeCategory.matches_generated && showAddAthletePanel && (
                    <div className="px-3 py-2 rounded-lg bg-amber-950/50 border border-amber-700/60 text-amber-300 text-[11px] font-medium">
                      Esta categoría ya tiene llave generada. Si agregas o quitas judokas, presiona{' '}
                      <strong>Regenerar Llave</strong> para actualizar los cruces.
                    </div>
                  )}

                  {/* Panel para buscar e inscribir judokas del torneo en esta categoría */}
                  {showAddAthletePanel && onAddAthleteToCategory && (
                    <div className="p-3 bg-slate-900 border border-blue-500/40 rounded-xl space-y-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2" />
                        <input
                          type="text"
                          placeholder="Buscar judoka inscrito en el torneo por Nombre, RUT o Club..."
                          value={addAthleteSearch}
                          onChange={(e) => setAddAthleteSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                          autoFocus
                        />
                      </div>

                      {availableAthletesToAdd.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-2 text-center">
                          No hay otros judokas disponibles en la nómina del torneo con esa búsqueda.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/70">
                          {availableAthletesToAdd.map((cand) => (
                            <div
                              key={cand.athlete_id}
                              className="py-2 px-1 flex items-center justify-between gap-2 text-xs hover:bg-slate-800/40 rounded"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate">
                                  {cand.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block truncate">
                                  {cand.rut_dni} · {cand.club_name} · Actual: {cand.category_name}
                                  {cand.actual_weight ? ` · ${cand.actual_weight} kg` : ''}
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={isMutatingCategoryAthlete}
                                onClick={() => onAddAthleteToCategory(cand.athlete_id, activeCategory.id)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex-shrink-0 disabled:opacity-50"
                              >
                                + Agregar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista actual de judokas en esta categoría */}
                  {categoryRegistrations.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      No hay judokas inscritos actualmente en esta categoría.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categoryRegistrations.map((reg) => (
                        <div
                          key={reg.id}
                          className="inline-flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <span className="font-bold text-white">{reg.name}</span>
                          <span className="text-[10px] text-slate-400">({reg.club_name})</span>
                          {reg.actual_weight ? (
                            <span className="text-[10px] font-mono text-slate-300">
                              {reg.actual_weight}kg
                            </span>
                          ) : null}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              reg.weigh_in_status === 'PASSED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : reg.weigh_in_status === 'DSQ'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {reg.weigh_in_status === 'PASSED'
                              ? 'OK'
                              : reg.weigh_in_status === 'DSQ'
                              ? 'EXCEDIDO'
                              : 'PEND'}
                          </span>
                          {onRemoveAthleteFromCategory && (
                            <button
                              type="button"
                              disabled={isMutatingCategoryAthlete}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Quitar a ${reg.name} de la categoría "${activeCategory.name}"?`
                                  )
                                ) {
                                  onRemoveAthleteFromCategory(reg);
                                }
                              }}
                              className="text-slate-500 hover:text-red-400 transition ml-1 disabled:opacity-50"
                              title={`Quitar a ${reg.name} de esta categoría`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RENDER DEL BRACKET VIEWER */}
                {categoryBrackets[activeCategory.id] ? (
                  <BracketViewer
                    bracketResult={categoryBrackets[activeCategory.id]}
                    categoryName={activeCategory.name}
                    onSaveModifiedBracket={onSaveBracketModification}
                  />
                ) : (
                  <div className="p-12 text-center space-y-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <Swords className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-sm font-bold text-white">
                      {activeCategory.matches_generated
                        ? 'Cargando visualización del sorteo...'
                        : activeCategory.passed_weigh_in === 1
                        ? 'Presiona "Declarar Campeón" para proclamar al único judoka de esta categoría.'
                        : 'Presiona "Generar Llave" para estructurar los cruces de esta categoría.'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      El sistema aplicará las reglas del sorteo oficial: con 1 competidor se proclama campeón directo,
                      con 2 competidores se disputará al Mejor de 3, entre 3 y 5 se genera Pool Doble o Round Robin, y para 6 o más
                      se dibuja el árbol de eliminación directa con repechajes y doble bronce.
                    </p>
                    {activeCategory.matches_generated && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => onSelectCategoryId(activeCategory.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition inline-flex items-center space-x-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reintentar Cargar Sorteo</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ==================================================================== */}
      {/* 2. DOCUMENTO OFICIAL DE CATEGORÍAS PESADAS (DESCARGA DIRECTA PDF)    */}
      {/* ==================================================================== */}
      <div
        id="printable-brackets-container"
        className="fixed -left-[9999px] top-0 w-[1200px] z-[-50] bg-slate-950 text-slate-100 p-6 space-y-8 pointer-events-none print:hidden"
        aria-hidden="true"
      >
        {weighedCategories.map((cat) => {
          const athletes = (registeredAthletes || []).filter(
            (a) => a.category_id === cat.id && (a.weigh_in_status === 'PASSED' || a.actual_weight !== null)
          );
          if (athletes.length === 0) return null;

          const catBracket =
            categoryBrackets[cat.id] ||
            generateCategoryBracket(
              athletes.map((a, i) => ({
                id: a.athlete_id || a.id,
                name: a.name,
                club_name: a.club_name,
                seed: i + 1,
                weight: a.actual_weight || undefined,
              })),
              {
                organization_id: tournament.id,
                tournament_id: tournament.id,
                category_id: cat.id,
                category_name: cat.name,
                tatami_number: cat.assigned_tatami_number || 1,
                match_duration_seconds: cat.match_duration_seconds || 240,
                preferred_format_5: preferredFormat5ByCategory[cat.id] || 'DOUBLE_POOL_5',
              }
            );

          return (
            <div
              key={cat.id}
              className="official-bracket-page w-[1150px] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-2"
            >
              <BracketViewer
                bracketResult={catBracket}
                categoryName={`${tournament.name} • ${cat.name} (Tatami #${cat.assigned_tatami_number})`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
