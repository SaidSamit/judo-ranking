'use client';

import React, { useMemo } from 'react';
import { Scale, RefreshCw, Search } from 'lucide-react';
import {
  parseWeightLimitFromCategory,
  isWeightValidForCategory,
  getSuggestedUpperCategory,
} from '@/lib/rules/judo-categories';
import { WeighInAthlete } from '@/app/actions/weigh-in';

interface TournamentWeighInTabProps {
  tournamentName: string;
  loadingWeighIn: boolean;
  onRefreshWeighIn: () => void;
  weighInSearch: string;
  onWeighInSearchChange: (val: string) => void;
  weighInCategoryFilter: string;
  onWeighInCategoryFilterChange: (val: string) => void;
  weighInCategoriesList: string[];
  weighInAthletes: WeighInAthlete[];
  weightInputs: Record<string, string>;
  onWeightInputChange: (athleteKey: string, val: string) => void;
  savingWeightId: string | null;
  onRecordWeight: (ath: WeighInAthlete, explicitWeight?: number) => void;
  onReclassifyAthlete: (ath: WeighInAthlete, suggestedCat: string, explicitWeight?: number) => void;
}

interface GroupedWeighInAthlete {
  athleteKey: string;
  primary: WeighInAthlete;
  registrations: WeighInAthlete[];
}

export function TournamentWeighInTab({
  tournamentName,
  loadingWeighIn,
  onRefreshWeighIn,
  weighInSearch,
  onWeighInSearchChange,
  weighInCategoryFilter,
  onWeighInCategoryFilterChange,
  weighInCategoriesList,
  weighInAthletes,
  weightInputs,
  onWeightInputChange,
  savingWeightId,
  onRecordWeight,
  onReclassifyAthlete,
}: TournamentWeighInTabProps) {
  // 1. Agrupar inscripciones por competidor (athlete_id) para mostrarlo UNA SOLA VEZ en báscula
  const groupedAthletes = useMemo<GroupedWeighInAthlete[]>(() => {
    const map = new Map<string, GroupedWeighInAthlete>();

    weighInAthletes.forEach((reg) => {
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
  }, [weighInAthletes]);

  // 2. Aplicar búsqueda y filtro de categoría sobre los competidores agrupados
  const filteredGroups = useMemo(() => {
    const q = weighInSearch.trim().toLowerCase();
    return groupedAthletes.filter(({ primary, registrations }) => {
      const matchesSearch =
        !q ||
        primary.name.toLowerCase().includes(q) ||
        primary.rut_dni.toLowerCase().includes(q) ||
        primary.club_name.toLowerCase().includes(q) ||
        registrations.some((r) => r.category_name.toLowerCase().includes(q));

      const matchesCat =
        weighInCategoryFilter === 'ALL' ||
        registrations.some((r) => r.category_name === weighInCategoryFilter);

      return matchesSearch && matchesCat;
    });
  }, [groupedAthletes, weighInSearch, weighInCategoryFilter]);

  return (
    <div className="space-y-6">
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span>Estación de Pesaje - {tournamentName}</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                {groupedAthletes.length} competidores
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada competidor aparece una sola vez en báscula. Al guardar su peso real, el sistema lo sincroniza y valida automáticamente en todas sus categorías inscritas.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onRefreshWeighIn}
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
              placeholder="Buscar por RUT, Nombre, Club o Categoría..."
              value={weighInSearch}
              onChange={(e) => onWeighInSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={weighInCategoryFilter}
              onChange={(e) => onWeighInCategoryFilterChange(e.target.value)}
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

        {/* TABLA DE PESAJE UNIFICADA POR COMPETIDOR */}
        {filteredGroups.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <Scale className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold">No hay judokas registrados para el pesaje.</p>
            <p className="text-xs">
              Ve a la pestaña &quot;Inscripciones&quot; para registrar judokas en este campeonato.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Judoka</th>
                  <th className="p-3">Categorías Asignadas</th>
                  <th className="p-3">Límite de Peso</th>
                  <th className="p-3 text-center">Peso Real (kg)</th>
                  <th className="p-3 text-center">Validación por Categoría</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredGroups.map(({ athleteKey, primary, registrations }) => {
                  const existingSavedWeight =
                    registrations.find((r) => typeof r.actual_weight === 'number' && r.actual_weight > 0)
                      ?.actual_weight ?? primary.actual_weight;

                  const inputVal =
                    weightInputs[athleteKey] ??
                    weightInputs[primary.registration_id] ??
                    (existingSavedWeight ? String(existingSavedWeight) : '');
                  const numVal = parseFloat(inputVal);
                  const hasWeight = !isNaN(numVal) && numVal > 0;

                  // Evaluar cada categoría individualmente contra el peso ingresado/guardado
                  const regEvaluations = registrations.map((reg) => {
                    const parsedLimit = parseWeightLimitFromCategory(reg.category_name);
                    const weightCheck = hasWeight
                      ? isWeightValidForCategory(numVal, reg.category_name)
                      : null;
                    const isOverweight = weightCheck ? !weightCheck.valid : false;
                    const suggestedCat = isOverweight
                      ? getSuggestedUpperCategory(reg.category_name, numVal)
                      : null;

                    return {
                      reg,
                      parsedLimit,
                      isOverweight,
                      suggestedCat,
                    };
                  });

                  const anyOverweight = regEvaluations.some((ev) => ev.isOverweight);
                  const isSavingThisAthlete =
                    savingWeightId === athleteKey ||
                    registrations.some((r) => r.registration_id === savingWeightId);

                  return (
                    <tr key={athleteKey} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <span className="font-bold text-white block">{primary.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {primary.rut_dni} · {primary.club_name}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {regEvaluations.map(({ reg }) => (
                            <span key={reg.registration_id} className="font-bold text-blue-300 leading-5">
                              {reg.category_name}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-400">
                        <div className="flex flex-col gap-1">
                          {regEvaluations.map(({ reg, parsedLimit }) => (
                            <span key={reg.registration_id} className="leading-5">
                              {parsedLimit
                                ? parsedLimit.isPlus
                                  ? `≥ ${parsedLimit.limit} kg`
                                  : `≤ ${parsedLimit.limit} kg`
                                : 'Abierto'}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="00.0"
                            value={inputVal}
                            onChange={(e) => onWeightInputChange(athleteKey, e.target.value)}
                            className={`w-20 px-2.5 py-1 text-center font-mono font-bold rounded-lg border text-xs ${
                              anyOverweight
                                ? 'bg-red-950/80 border-red-500 text-red-300'
                                : 'bg-slate-950 border-slate-700 text-white'
                            }`}
                          />
                          <span className="text-slate-500 text-[11px]">kg</span>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {regEvaluations.map(({ reg, isOverweight }) => {
                            const effectiveStatus = hasWeight
                              ? isOverweight
                                ? 'DSQ'
                                : reg.weigh_in_status === 'PASSED'
                                ? 'PASSED'
                                : reg.weigh_in_status === 'DSQ'
                                ? 'DSQ'
                                : 'PENDING'
                              : reg.weigh_in_status;

                            return effectiveStatus === 'PASSED' ? (
                              <span
                                key={reg.registration_id}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800"
                              >
                                APROBADO
                              </span>
                            ) : effectiveStatus === 'DSQ' || isOverweight ? (
                              <span
                                key={reg.registration_id}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-950 text-red-400 border border-red-800"
                              >
                                EXCEDIDO
                              </span>
                            ) : (
                              <span
                                key={reg.registration_id}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-400 border border-amber-800"
                              >
                                PENDIENTE
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end flex-wrap gap-1.5">
                          {regEvaluations
                            .filter((ev) => ev.suggestedCat)
                            .map(({ reg, suggestedCat }) => (
                              <button
                                key={reg.registration_id}
                                type="button"
                                onClick={() =>
                                  onReclassifyAthlete(reg, suggestedCat!, hasWeight ? numVal : undefined)
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-bold transition flex items-center space-x-1"
                                title={`Reclasificar ${reg.category_name} a ${suggestedCat}`}
                              >
                                <span>
                                  {registrations.length > 1
                                    ? `Subir (${reg.category_name.split(' ').pop()}) ➔ ${suggestedCat!.split(' ').pop()}`
                                    : `Subir a ${suggestedCat!.split(' ').pop()}`}
                                </span>
                              </button>
                            ))}

                          <button
                            type="button"
                            onClick={() => onRecordWeight(primary, hasWeight ? numVal : undefined)}
                            disabled={isSavingThisAthlete}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition disabled:opacity-50"
                          >
                            {isSavingThisAthlete ? '...' : 'Guardar'}
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
  );
}
