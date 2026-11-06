'use client';

import React from 'react';
import { Users, RefreshCw, Plus } from 'lucide-react';
import { RosterUpload } from '@/components/admin/roster-upload';
import { RegisteredAthleteSummary } from '@/app/actions/registrations';

interface TournamentRosterTabProps {
  tournament: {
    id: string;
    name: string;
  };
  categories: any[];
  registeredAthletes: RegisteredAthleteSummary[];
  loadingRoster: boolean;
  onRefreshRoster: () => void;
  rosterSearch: string;
  onRosterSearchChange: (val: string) => void;
  athleteRegistrationCounts: Map<string, number>;
  onOpenAdditionalCategoryModal: (ath: RegisteredAthleteSummary) => void;
  onOpenReassignModal: (ath: RegisteredAthleteSummary) => void;
  onRegistrationsConfirmed: () => void;
}

export function TournamentRosterTab({
  tournament,
  categories,
  registeredAthletes,
  loadingRoster,
  onRefreshRoster,
  rosterSearch,
  onRosterSearchChange,
  athleteRegistrationCounts,
  onOpenAdditionalCategoryModal,
  onOpenReassignModal,
  onRegistrationsConfirmed,
}: TournamentRosterTabProps) {
  const filteredAthletes = registeredAthletes.filter((ath) => {
    const q = rosterSearch.toLowerCase();
    return (
      ath.name.toLowerCase().includes(q) ||
      ath.rut_dni.toLowerCase().includes(q) ||
      ath.club_name.toLowerCase().includes(q) ||
      ath.category_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* TABLA DE JUDOKAS CONFIRMADOS EN ESTE TORNEO */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Judokas Confirmados en este Campeonato ({registeredAthletes.length})
            </h3>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Buscar por RUT, Nombre o Club..."
              value={rosterSearch}
              onChange={(e) => onRosterSearchChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 w-64"
            />
            <button
              type="button"
              onClick={onRefreshRoster}
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
              No hay judokas inscritos todavía en "{tournament.name}".
            </p>
            <p className="text-xs max-w-md mx-auto">
              Usa el formulario inferior para agregar judokas individualmente o importar un archivo CSV.
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
                  <th className="p-3">Categoría Asignada</th>
                  <th className="p-3 text-center">Estado Pesaje</th>
                  <th className="p-3 text-right">Peso Real</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredAthletes.map((ath) => (
                  <tr key={ath.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-amber-400">{ath.rut_dni}</td>
                    <td className="p-3 font-bold text-white">{ath.name}</td>
                    <td className="p-3 text-slate-300">{ath.club_name}</td>
                    <td className="p-3 text-slate-400">
                      {ath.birth_year} ({ath.gender === 'M' ? 'Masc' : 'Fem'})
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800/80 text-[11px] font-bold self-start">
                          {ath.category_name}
                        </span>
                        {(athleteRegistrationCounts.get(ath.athlete_id) || 0) > 1 && (
                          <>
                            {registeredAthletes
                              .filter((r) => r.athlete_id === ath.athlete_id && r.id !== ath.id)
                              .map((r) => (
                                <span
                                  key={r.id}
                                  className="px-2 py-0.5 rounded-lg bg-amber-950/70 text-amber-300 border border-amber-700/60 text-[10px] font-bold self-start"
                                >
                                  + {r.category_name}
                                </span>
                              ))}
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold self-start">
                              {athleteRegistrationCounts.get(ath.athlete_id)} Categorías
                            </span>
                          </>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenAdditionalCategoryModal(ath)}
                          className="px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-sm"
                          title="Inscribir a este judoka en una categoría adicional (e.g. Sub-15 y Sub-18)"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Adicional</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReassignModal(ath)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold transition"
                          title="Cambiar o reasignar categoría existente"
                        >
                          Cambiar
                        </button>
                      </div>
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
          onRegistrationsConfirmed={onRegistrationsConfirmed}
        />
      </div>
    </div>
  );
}
