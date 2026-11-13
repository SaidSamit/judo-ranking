'use client';

import React, { useState, useMemo, useTransition } from 'react';
import {
  Scale,
  RefreshCw,
  Search,
  LogOut,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import {
  parseWeightLimitFromCategory,
  isWeightValidForCategory,
  getSuggestedUpperCategory,
  sortCategoryNames,
} from '@/lib/rules/judo-categories';
import {
  WeighInAthlete,
  getWeighInAthletesAction,
  recordAthleteWeightAction,
} from '@/app/actions/weigh-in';
import { logoutStationAction } from '@/app/actions/auth';

interface StationWeighInViewProps {
  station: {
    id: string;
    name: string;
    slug: string;
    type: string;
    metadata?: {
      gender_filter?: 'M' | 'F';
      [key: string]: any;
    } | null;
  };
  tournament: {
    id: string;
    name: string;
  };
  initialAthletes: WeighInAthlete[];
}

interface GroupedAthlete {
  athleteKey: string;
  primary: WeighInAthlete;
  registrations: WeighInAthlete[];
}

export function StationWeighInView({
  station,
  tournament,
  initialAthletes,
}: StationWeighInViewProps) {
  const [athletes, setAthletes] = useState<WeighInAthlete[]>(initialAthletes);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PASSED' | 'DSQ'>('ALL');
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const genderFilter = station.metadata?.gender_filter;

  // 1. Filtrar atletas por el género de la estación (si tiene filtro configurado en metadata)
  const stationFilteredAthletes = useMemo(() => {
    if (!genderFilter) return athletes;
    return athletes.filter((a) => a.gender === genderFilter);
  }, [athletes, genderFilter]);

  // 2. Agrupar inscripciones por atleta único (para que el competidor aparezca una sola vez en báscula)
  const groupedAthletes = useMemo<GroupedAthlete[]>(() => {
    const map = new Map<string, GroupedAthlete>();

    stationFilteredAthletes.forEach((reg) => {
      const key = reg.athlete_id || reg.registration_id;
      const existing = map.get(key);
      if (existing) {
        existing.registrations.push(reg);
      } else {
        map.set(key, {
          athleteKey: key,
          primary: reg,
          registrations: [reg],
        });
      }
    });

    return Array.from(map.values());
  }, [stationFilteredAthletes]);

  // 3. Extraer categorías únicas para el filtro desplegable (ordenadas canónicamente por edad, género y peso)
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    stationFilteredAthletes.forEach((a) => {
      if (a.category_name) set.add(a.category_name);
    });
    return sortCategoryNames(Array.from(set));
  }, [stationFilteredAthletes]);

  // 4. Métricas de pesaje para la estación
  const metrics = useMemo(() => {
    let total = groupedAthletes.length;
    let passed = 0;
    let pending = 0;
    let dsq = 0;

    groupedAthletes.forEach(({ primary }) => {
      if (primary.weigh_in_status === 'PASSED') passed++;
      else if (primary.weigh_in_status === 'DSQ') dsq++;
      else pending++;
    });

    return { total, passed, pending, dsq };
  }, [groupedAthletes]);

  // 5. Aplicar búsqueda y filtros
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return groupedAthletes.filter(({ primary, registrations }) => {
      const matchesSearch =
        !q ||
        primary.name.toLowerCase().includes(q) ||
        primary.rut_dni.toLowerCase().includes(q) ||
        primary.club_name.toLowerCase().includes(q) ||
        registrations.some((r) => r.category_name.toLowerCase().includes(q));

      const matchesCategory =
        categoryFilter === 'ALL' ||
        registrations.some((r) => r.category_name === categoryFilter);

      const matchesStatus =
        statusFilter === 'ALL' || primary.weigh_in_status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [groupedAthletes, searchQuery, categoryFilter, statusFilter]);

  // Recargar datos desde el servidor
  const handleRefresh = async () => {
    startTransition(async () => {
      const res = await getWeighInAthletesAction(tournament.id);
      if (res.success) {
        setAthletes(res.athletes);
        setFeedbackMessage({ type: 'success', text: 'Datos de pesaje actualizados.' });
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    });
  };

  // Guardar peso de un atleta
  const handleSaveWeight = async (group: GroupedAthlete) => {
    const inputVal = weightInputs[group.athleteKey];
    const weightNum = parseFloat(inputVal || '');

    if (isNaN(weightNum) || weightNum <= 0) {
      setFeedbackMessage({
        type: 'error',
        text: `Ingresa un peso válido en kilogramos para ${group.primary.name}.`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    setSavingKey(group.athleteKey);
    setFeedbackMessage(null);

    try {
      // Validar si el peso cumple con la categoría principal
      const { valid } = isWeightValidForCategory(weightNum, group.primary.category_name);
      const status: 'PASSED' | 'DSQ' = valid ? 'PASSED' : 'DSQ';

      const res = await recordAthleteWeightAction({
        registrationId: group.primary.registration_id,
        actualWeight: weightNum,
        status,
        tournamentId: tournament.id,
      });

      if (res.success) {
        // Actualizar estado local inmediatamente
        setAthletes((prev) =>
          prev.map((a) => {
            if (a.athlete_id === group.primary.athlete_id) {
              return {
                ...a,
                actual_weight: weightNum,
                weigh_in_status: status,
                weigh_in_at: new Date().toISOString(),
              };
            }
            return a;
          })
        );

        setFeedbackMessage({
          type: 'success',
          text: `Peso (${weightNum} kg) guardado para ${group.primary.name}. Estado: ${
            status === 'PASSED' ? 'Aprobado' : 'Fuera de peso'
          }.`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Error al guardar el pesaje.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Error de comunicación con el servidor al guardar peso.',
      });
    } finally {
      setSavingKey(null);
    }
  };

  // Reclasificar atleta a una categoría superior sugerida
  const handleReclassifyWeight = async (group: GroupedAthlete, targetCategory: string) => {
    const inputVal = weightInputs[group.athleteKey];
    const weightNum = parseFloat(inputVal || '') || group.primary.actual_weight || 0;

    if (isNaN(weightNum) || weightNum <= 0) {
      setFeedbackMessage({
        type: 'error',
        text: `Ingresa un peso válido para reclasificar a ${group.primary.name}.`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    setSavingKey(group.athleteKey);
    setFeedbackMessage(null);

    try {
      const res = await recordAthleteWeightAction({
        registrationId: group.primary.registration_id,
        actualWeight: weightNum,
        status: 'PASSED',
        newCategoryName: targetCategory,
        tournamentId: tournament.id,
      });

      if (res.success) {
        setAthletes((prev) =>
          prev.map((a) => {
            if (a.athlete_id === group.primary.athlete_id) {
              return {
                ...a,
                category_name: res.updatedCategory || targetCategory,
                actual_weight: weightNum,
                weigh_in_status: 'PASSED',
                weigh_in_at: new Date().toISOString(),
              };
            }
            return a;
          })
        );

        setFeedbackMessage({
          type: 'success',
          text: `${group.primary.name} reclasificado exitosamente a ${targetCategory} con ${weightNum} kg (Aprobado).`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Error al reclasificar al competidor.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Error de comunicación con el servidor al reclasificar.',
      });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* BARRA SUPERIOR INSTITUCIONAL (RESPONSIVA) */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-3.5 sm:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {station.name}
              </h1>
              {genderFilter === 'M' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-950 text-blue-300 border border-blue-800 shrink-0">
                  Solo Varones (M)
                </span>
              ) : genderFilter === 'F' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-950 text-pink-300 border border-pink-800 shrink-0">
                  Solo Damas (F)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
                  Báscula General (M/F)
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
              <span className="flex items-center space-x-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400 inline shrink-0" />
                <span>Torneo: <strong className="text-slate-200">{tournament.name}</strong></span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="font-mono text-slate-400">Estación: {station.slug}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
            title="Actualizar nómina"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-amber-400' : ''}`} />
            <span>Actualizar</span>
          </button>

          <form action={logoutStationAction} className="flex-1 sm:flex-initial">
            <button
              type="submit"
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
              title="Cerrar sesión de báscula"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </form>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        {/* MENSAJE DE FEEDBACK */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2 border transition ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-red-950/80 border-red-800 text-red-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* TARJETAS DE RESUMEN / MÉTRICAS (RESPONSIVAS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
              Total Judokas
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">{metrics.total}</div>
            <span className="text-[9px] sm:text-[10px] text-slate-500 block truncate">Asignados a báscula</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1 truncate">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="truncate">Pesados / Aptos</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{metrics.passed}</div>
            <span className="text-[9px] sm:text-[10px] text-emerald-500/80 block truncate">Listos para competir</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1 truncate">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">Pendientes</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{metrics.pending}</div>
            <span className="text-[9px] sm:text-[10px] text-amber-500/80 block truncate">Aún no pasan a báscula</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center space-x-1 truncate">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">Exceden Peso</span>
            </span>
            <div className="text-xl sm:text-2xl font-black text-red-400 font-mono">{metrics.dsq}</div>
            <span className="text-[9px] sm:text-[10px] text-red-400/80 block truncate">Requieren cambio</span>
          </div>
        </div>

        {/* CONTROLES: BUSCADOR Y FILTROS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 shadow-lg">
          {/* BUSCADOR */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, RUT / DNI o club..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-medium focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* FILTROS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-300 font-medium focus:outline-none w-full"
              >
                <option value="ALL" className="bg-slate-900 text-white">Todas las Categorías</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-[11px] font-bold text-center">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`py-1.5 rounded-lg transition ${
                  statusFilter === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`py-1.5 rounded-lg transition ${
                  statusFilter === 'PENDING' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PASSED')}
                className={`py-1.5 rounded-lg transition ${
                  statusFilter === 'PASSED' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Aptos
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VISTA MÓVIL (TARJETAS TÁCTILES ERGONÓMICAS: PANTALLAS < 768px)  */}
        {/* ============================================================== */}
        <div className="block md:hidden space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No se encontraron judokas para los filtros actuales.
            </div>
          ) : (
            filteredGroups.map((group) => {
              const primary = group.primary;
              const key = group.athleteKey;
              const currentWeight = primary.actual_weight;
              const inputVal = weightInputs[key] ?? (currentWeight ? String(currentWeight) : '');
              const isSaving = savingKey === key;

              const weightLimit = parseWeightLimitFromCategory(primary.category_name);
              const limitFormatted = weightLimit
                ? weightLimit.isPlus
                  ? `≥ ${weightLimit.limit} kg`
                  : `≤ ${weightLimit.limit} kg`
                : 'Abierto';

              const numVal = parseFloat(inputVal || '') || (currentWeight ?? 0);
              const hasInput = !isNaN(parseFloat(inputVal || '')) && parseFloat(inputVal || '') > 0;
              const weightCheck = hasInput ? isWeightValidForCategory(parseFloat(inputVal), primary.category_name) : null;
              const isOverweight = weightCheck ? !weightCheck.valid : false;
              const suggestedUpper = hasInput && isOverweight ? getSuggestedUpperCategory(primary.category_name, parseFloat(inputVal)) : null;

              return (
                <div
                  key={`mobile-${key}`}
                  className={`bg-slate-900 border rounded-2xl p-4 space-y-3 shadow-md transition ${
                    isOverweight
                      ? 'border-red-800/80 bg-red-950/10'
                      : primary.weigh_in_status === 'PASSED'
                      ? 'border-emerald-800/60 bg-emerald-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  {/* ENCABEZADO: NOMBRE, RUT, CLUB Y ESTADO */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-white leading-tight">
                        {primary.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                        <span className="text-amber-400 font-bold">{primary.rut_dni || 'Sin RUT'}</span>
                        <span>•</span>
                        <span className="truncate">{primary.club_name}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {primary.weigh_in_status === 'PASSED' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Aprobado</span>
                        </span>
                      ) : primary.weigh_in_status === 'DSQ' || isOverweight ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Excede Peso</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-950/80 text-amber-400 border border-amber-800">
                          <Clock className="w-3 h-3" />
                          <span>Pendiente</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CATEGORÍA Y LÍMITE */}
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Categoría Oficial:</span>
                      <span className="font-mono font-bold text-slate-300 text-[11px]">
                        Límite: <strong className="text-amber-400">{limitFormatted}</strong>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.registrations.map((reg) => (
                        <div key={reg.registration_id} className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-300">{reg.category_name}</span>
                          {reg.actual_weight && (
                            <span className="text-[10px] font-mono text-emerald-400">
                              ({reg.actual_weight} kg)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ADVERTENCIA DE EXCESO DE PESO */}
                  {isOverweight && (
                    <div className="bg-red-950/50 border border-red-800/80 rounded-xl p-2.5 text-xs text-red-200 space-y-2">
                      <div className="flex items-center space-x-1.5 font-bold text-red-300">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Excede el límite oficial ({limitFormatted})</span>
                      </div>
                      {suggestedUpper && (
                        <button
                          type="button"
                          onClick={() => handleReclassifyWeight(group, suggestedUpper)}
                          disabled={isSaving}
                          className="w-full py-2 px-3 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-700/80 text-amber-300 text-xs font-bold transition flex items-center justify-center space-x-1.5"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>Subir a {suggestedUpper}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* ZONA DE CAPTURA TÁCTIL DE PESO */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.05"
                        min="10"
                        max="200"
                        value={inputVal}
                        onChange={(e) =>
                          setWeightInputs((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveWeight(group);
                          }
                        }}
                        placeholder="00.00"
                        className={`w-full bg-slate-950 border rounded-xl py-2.5 px-3 text-center text-lg font-mono font-black text-white placeholder-slate-600 focus:outline-none ${
                          isOverweight
                            ? 'border-red-500 focus:border-red-400 text-red-200'
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-bold">
                        kg
                      </span>
                    </div>

                    {/* BOTÓN GUARDAR PESO A ANCHO COMPLETO PARA EL PULGAR */}
                    <button
                      type="button"
                      onClick={() => handleSaveWeight(group)}
                      disabled={isSaving}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando peso...</span>
                        </>
                      ) : (
                        <>
                          <Scale className="w-3.5 h-3.5" />
                          <span>Guardar Peso en Báscula</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ============================================================== */}
        {/* VISTA ESCRITORIO (TABLA DE ALTA DENSIDAD: PANTALLAS ≥ 768px)     */}
        {/* ============================================================== */}
        <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Judoka / Atleta</th>
                  <th className="px-4 py-3.5">Categoría(s) Inscrita(s)</th>
                  <th className="px-4 py-3.5">Límite Oficial</th>
                  <th className="px-4 py-3.5 text-center">Peso en Báscula (kg)</th>
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No se encontraron judokas pendientes o registrados para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group) => {
                    const primary = group.primary;
                    const key = group.athleteKey;
                    const currentWeight = primary.actual_weight;
                    const inputVal = weightInputs[key] ?? (currentWeight ? String(currentWeight) : '');
                    const isSaving = savingKey === key;

                    const weightLimit = parseWeightLimitFromCategory(primary.category_name);
                    const limitFormatted = weightLimit
                      ? weightLimit.isPlus
                        ? `≥ ${weightLimit.limit} kg`
                        : `≤ ${weightLimit.limit} kg`
                      : 'Abierto';

                    const numVal = parseFloat(inputVal || '') || (currentWeight ?? 0);
                    const hasInput = !isNaN(parseFloat(inputVal || '')) && parseFloat(inputVal || '') > 0;
                    const weightCheck = hasInput ? isWeightValidForCategory(parseFloat(inputVal), primary.category_name) : null;
                    const isOverweight = weightCheck ? !weightCheck.valid : false;
                    const suggestedUpper = hasInput && isOverweight ? getSuggestedUpperCategory(primary.category_name, parseFloat(inputVal)) : null;

                    return (
                      <tr key={key} className="hover:bg-slate-800/40 transition">
                        {/* ATLETA */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-white text-sm">{primary.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 font-mono">
                            <span className="text-amber-400 font-bold">{primary.rut_dni || 'Sin RUT'}</span>
                            <span>•</span>
                            <span>{primary.club_name}</span>
                          </div>
                        </td>

                        {/* CATEGORÍAS */}
                        <td className="px-4 py-3 space-y-1">
                          {group.registrations.map((reg) => (
                            <div key={reg.registration_id} className="flex items-center space-x-1.5">
                              <span className="font-bold text-blue-300">{reg.category_name}</span>
                              {reg.actual_weight && (
                                <span className="text-[10px] font-mono text-emerald-400">
                                  ({reg.actual_weight} kg)
                                </span>
                              )}
                            </div>
                          ))}
                        </td>

                        {/* LÍMITE */}
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {limitFormatted}
                        </td>

                        {/* INPUT PESO REAL */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.05"
                              min="10"
                              max="200"
                              value={inputVal}
                              onChange={(e) =>
                                setWeightInputs((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveWeight(group);
                                }
                              }}
                              placeholder="00.00"
                              className={`w-24 bg-slate-950 border rounded-xl px-2.5 py-1.5 text-sm font-mono font-bold text-center focus:outline-none ${
                                isOverweight
                                  ? 'border-red-500 text-red-200'
                                  : 'border-slate-700 text-white focus:border-amber-400'
                              }`}
                            />
                            <span className="text-xs text-slate-400 font-mono">kg</span>
                          </div>
                        </td>

                        {/* ESTADO */}
                        <td className="px-4 py-3 text-center">
                          {primary.weigh_in_status === 'PASSED' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Aprobado</span>
                            </span>
                          ) : primary.weigh_in_status === 'DSQ' || isOverweight ? (
                            <div className="space-y-1 flex flex-col items-center">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Excede Peso</span>
                              </span>
                              {suggestedUpper && (
                                <button
                                  type="button"
                                  onClick={() => handleReclassifyWeight(group, suggestedUpper)}
                                  disabled={isSaving}
                                  className="text-[10px] text-amber-300 hover:text-amber-200 bg-amber-950/70 border border-amber-800/80 rounded-md px-1.5 py-0.5 font-bold transition flex items-center space-x-1"
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Subir a {suggestedUpper.split(' ').pop()}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-950/80 text-amber-400 border border-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>Pendiente</span>
                            </span>
                          )}
                        </td>

                        {/* ACCIÓN */}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveWeight(group)}
                            disabled={isSaving}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow disabled:opacity-50"
                          >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
