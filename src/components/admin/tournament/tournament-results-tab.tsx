'use client';

import React, { useMemo } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { CategoryPodiumResult } from '@/app/actions/brackets';
import { compareJudoCategories } from '@/lib/rules/judo-categories';

export interface ClubMedalRow {
  club: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface TournamentResultsTabProps {
  tournamentName: string;
  podiumResults: CategoryPodiumResult[];
  clubMedalRanking: ClubMedalRow[];
  loadingPodiums: boolean;
  onRefreshPodiums: () => void;
}

export function TournamentResultsTab({
  tournamentName,
  podiumResults,
  clubMedalRanking,
  loadingPodiums,
  onRefreshPodiums,
}: TournamentResultsTabProps) {
  const sortedPodiumResults = useMemo(() => {
    return [...podiumResults].sort((a, b) =>
      compareJudoCategories(
        { name: a.categoryName, gender: a.gender },
        { name: b.categoryName, gender: b.gender }
      )
    );
  }, [podiumResults]);
  return (
    <div className="space-y-6">
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Resultados y Podios - {tournamentName}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cuadro de honor con 1° (Oro), 2° (Plata), 3° (Doble Bronce oficial), 5° y 7° lugar por categoría.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefreshPodiums}
            disabled={loadingPodiums}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPodiums ? 'animate-spin' : ''}`} />
            <span>Actualizar Podios</span>
          </button>
        </div>

        {/* MEDALLERO POR CLUBES */}
        {podiumResults.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Medallero por Clubes</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {clubMedalRanking.length} {clubMedalRanking.length === 1 ? 'club' : 'clubes'}
              </span>
            </div>

            {clubMedalRanking.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Las medallas se computarán automáticamente a medida que finalicen las categorías o se proclamen campeones.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-black uppercase text-slate-400">
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3">Club / Institución</th>
                      <th className="py-2.5 px-3 text-center w-24 text-amber-400">🥇 Oro</th>
                      <th className="py-2.5 px-3 text-center w-24 text-slate-300">🥈 Plata</th>
                      <th className="py-2.5 px-3 text-center w-24 text-orange-400">🥉 Bronce</th>
                      <th className="py-2.5 px-3 text-center w-24 text-emerald-400 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {clubMedalRanking.map((row, idx) => (
                      <tr key={row.club} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                          {idx === 0 ? '🏆 1' : `${idx + 1}°`}
                        </td>
                        <td className="py-2 px-3 font-bold text-white">
                          {row.club}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-amber-400 bg-amber-500/5">
                          {row.gold}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300 bg-slate-400/5">
                          {row.silver}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-400 bg-orange-600/5">
                          {row.bronze}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-black text-emerald-400 bg-emerald-500/5">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LISTADO DE PODIOS POR CATEGORÍA */}
        {podiumResults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Trophy className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-400">No hay categorías configuradas o combates disputados aún.</p>
            <p className="text-xs">A medida que se definan los combates en la mesa de control, los resultados se reflejarán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedPodiumResults.map((pr) => {
              const isUncontested =
                (pr.totalMatches <= 1 && !pr.podium.secondPlace && pr.podium.firstPlace) ||
                (!pr.podium.secondPlace && !pr.podium.thirdPlaceA && !pr.podium.thirdPlaceB && pr.podium.firstPlace);

              return (
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

                  {/* CUADRO DE HONOR Y MEDALLAS */}
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

                    {/* Si es categoría de 1 judoka (sin contendor), ocultar Plata y Bronce vacíos */}
                    {isUncontested ? (
                      <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center">
                        <span className="text-[11px] text-amber-300/90 font-medium">
                          Categoría sin contendor • Medalla de oro directa adjudicada
                        </span>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}

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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

