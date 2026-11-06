'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, Swords, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { BracketViewer } from '@/components/admin/bracket-viewer';
import { CategoryBracketStatus } from '@/app/actions/brackets';
import { BracketResult } from '@/lib/rules/bracket-engine';

interface TatamiDistItem {
  tatamiNum: number;
  categoriesCount: number;
  athletesCount: number;
}

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
  isGeneratingBrackets: boolean;
  onGenerateBracket: (category: CategoryBracketStatus) => void;
  onSaveBracketModification: (bracket: BracketResult) => Promise<void> | void;
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
  isGeneratingBrackets,
  onGenerateBracket,
  onSaveBracketModification,
}: TournamentBracketsTabProps) {
  const activeCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;

  return (
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
              Genera las llaves y cruces según el pesaje cerrado. Modifica cruces o visualiza el
              árbol de eliminación / Round Robin.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
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

        {categories.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <Trophy className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold">No hay categorías configuradas en este campeonato.</p>
            <p className="text-xs">
              Inscribe judokas en la pestaña de Nómina para comenzar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const isSelected = cat.id === (selectedCategoryId || activeCategory?.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategoryId(cat.id)}
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
                    {cat.bracket_type === 'UNCONTESTED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">
                        Campeón Directo
                      </span>
                    ) : cat.matches_generated ? (
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
                        ? 'Todos contra Todos'
                        : cat.bracket_type === 'BEST_OF_3'
                        ? 'Al Mejor de 3'
                        : cat.bracket_type === 'DOUBLE_POOL_5'
                        ? 'Pool Doble'
                        : cat.bracket_type === 'UNCONTESTED'
                        ? 'Campeón Directo'
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
                      onClick={() => onReassignTatami(activeCategory.id, tNum)}
                      disabled={isReassigningTatami || activeCategory.assigned_tatami_number === tNum}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        activeCategory.assigned_tatami_number === tNum
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                      } ${isReassigningTatami ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Tatami {tNum}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-1.5">
                Tipo de Cruce:{' '}
                <strong className="text-white">
                  {activeCategory.passed_weigh_in === 5
                    ? (preferredFormat5ByCategory[activeCategory.id] === 'ROUND_ROBIN'
                        ? 'Todos contra Todos (Round Robin)'
                        : 'Pool Doble')
                    : activeCategory.bracket_type === 'ROUND_ROBIN'
                    ? 'Todos contra Todos (Round Robin)'
                    : activeCategory.bracket_type === 'DOUBLE_POOL_5'
                    ? 'Pool Doble'
                    : activeCategory.bracket_type === 'BEST_OF_3'
                    ? 'Al Mejor de 3'
                    : activeCategory.bracket_type === 'UNCONTESTED'
                    ? 'Campeón Directo (Sin Competidor)'
                    : 'Eliminación Simple'}
                </strong>
              </p>

              {activeCategory.passed_weigh_in === 5 && (
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-slate-400 font-bold">Modalidad 5 Judokas:</span>
                  <button
                    type="button"
                    onClick={() => onSetPreferredFormat5(activeCategory.id, 'DOUBLE_POOL_5')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      (preferredFormat5ByCategory[activeCategory.id] || 'DOUBLE_POOL_5') === 'DOUBLE_POOL_5'
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

            <div className="flex items-center space-x-2">
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
                se dibuja el árbol de eliminación directa con repechajes y doble bronce IJF.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
