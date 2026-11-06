'use client';

import React from 'react';
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
  filteredWeighInAthletes: WeighInAthlete[];
  weightInputs: Record<string, string>;
  onWeightInputChange: (regId: string, val: string) => void;
  savingWeightId: string | null;
  onRecordWeight: (ath: WeighInAthlete) => void;
  onReclassifyAthlete: (ath: WeighInAthlete, suggestedCat: string) => void;
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
  filteredWeighInAthletes,
  weightInputs,
  onWeightInputChange,
  savingWeightId,
  onRecordWeight,
  onReclassifyAthlete,
}: TournamentWeighInTabProps) {
  return (
    <div className="space-y-6">
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span>Estación de Pesaje - {tournamentName}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registra el peso en báscula. Si el judoka excede su división, el sistema sugerirá la
              categoría inmediata superior para reclasificación con un clic.
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
              placeholder="Buscar por RUT, Nombre o Club..."
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

        {/* TABLA DE PESAJE */}
        {filteredWeighInAthletes.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <Scale className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold">No hay judokas registrados para el pesaje.</p>
            <p className="text-xs">
              Ve a la pestaña "Nómina & Inscripciones" para registrar judokas en este campeonato.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Judoka</th>
                  <th className="p-3">Categoría Asignada</th>
                  <th className="p-3">Límite de Peso</th>
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
                              onWeightInputChange(ath.registration_id, e.target.value)
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
                              onClick={() => onReclassifyAthlete(ath, suggestedCat)}
                              className="px-2.5 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-bold transition flex items-center space-x-1"
                              title={`Reclasificar a ${suggestedCat}`}
                            >
                              <span>Subir a {suggestedCat.split(' ').pop()}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onRecordWeight(ath)}
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
  );
}
