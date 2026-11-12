'use client';

import React, { useMemo } from 'react';
import { Users, RefreshCw, Plus, X } from 'lucide-react';
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
  onRemoveRegistration?: (ath: RegisteredAthleteSummary) => void;
  onRegistrationsConfirmed: () => void;
}

interface GroupedRosterAthlete {
  key: string;
  primary: RegisteredAthleteSummary;
  registrations: RegisteredAthleteSummary[];
}

export function TournamentRosterTab({
  tournament,
  categories,
  registeredAthletes,
  loadingRoster,
  onRefreshRoster,
  rosterSearch,
  onRosterSearchChange,
  onOpenAdditionalCategoryModal,
  onOpenReassignModal,
  onRemoveRegistration,
  onRegistrationsConfirmed,
}: TournamentRosterTabProps) {
  // Agrupar inscripciones por judoka (athlete_id) para mostrar una única fila por deportista
  const groupedAthletes = useMemo<GroupedRosterAthlete[]>(() => {
    const map = new Map<string, GroupedRosterAthlete>();

    registeredAthletes.forEach((reg) => {
      const key = reg.athlete_id || reg.id;
      const existing = map.get(key);
      if (existing) {
        existing.registrations.push(reg);
      } else {
        map.set(key, {
          key,
          primary: reg,
          registrations: [reg],
        });
      }
    });

    return Array.from(map.values());
  }, [registeredAthletes]);

  const filteredAthletes = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return groupedAthletes;

    return groupedAthletes.filter((group) => {
      const { primary, registrations } = group;
      return (
        primary.name.toLowerCase().includes(q) ||
        primary.rut_dni.toLowerCase().includes(q) ||
        primary.club_name.toLowerCase().includes(q) ||
        registrations.some((r) => r.category_name.toLowerCase().includes(q))
      );
    });
  }, [groupedAthletes, rosterSearch]);

  return (
    <div className="space-y-6">
      {/* TABLA DE JUDOKAS CONFIRMADOS EN ESTE TORNEO */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Judokas Confirmados en este Campeonato ({groupedAthletes.length})
            </h3>
            {registeredAthletes.length > groupedAthletes.length && (
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                {registeredAthletes.length} inscripciones
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Buscar por RUT, Nombre, Club o Categoría..."
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

        {groupedAthletes.length === 0 ? (
          <div className="p-12 text-center space-y-3 text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-400">
              No hay judokas inscritos todavía en &quot;{tournament.name}&quot;.
            </p>
            <p className="text-xs max-w-md mx-auto">
              Usa el formulario inferior para agregar judokas individualmente o importar un archivo Excel / CSV.
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
                  <th className="p-3">Categorías Asignadas</th>
                  <th className="p-3 text-center">Estado Pesaje</th>
                  <th className="p-3 text-right">Peso Real</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredAthletes.map(({ key, primary, registrations }) => (
                  <tr key={key} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-amber-400">{primary.rut_dni}</td>
                    <td className="p-3 font-bold text-white">{primary.name}</td>
                    <td className="p-3 text-slate-300">{primary.club_name}</td>
                    <td className="p-3 text-slate-400">
                      {primary.birth_year} ({primary.gender === 'M' ? 'Masc' : 'Fem'})
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {registrations.map((reg) => (
                          <div
                            key={reg.id}
                            className="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800/80 text-[11px] font-bold"
                          >
                            <span>{reg.category_name}</span>
                            {onRemoveRegistration && (
                              <button
                                type="button"
                                onClick={() => onRemoveRegistration(reg)}
                                className="text-slate-400 hover:text-red-400 transition ml-0.5"
                                title={`Quitar de ${reg.category_name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {registrations.map((reg) => (
                          <span
                            key={reg.id}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              reg.weigh_in_status === 'PASSED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : reg.weigh_in_status === 'DSQ'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {reg.weigh_in_status === 'PASSED'
                              ? 'PESADO'
                              : reg.weigh_in_status === 'DSQ'
                              ? 'DSQ'
                              : 'PENDIENTE'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {primary.actual_weight ? `${primary.actual_weight} kg` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenAdditionalCategoryModal(primary)}
                          className="px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-sm"
                          title="Inscribir a este judoka en una categoría adicional del torneo"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Adicional</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReassignModal(primary)}
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
