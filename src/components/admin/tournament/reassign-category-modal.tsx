'use client';

import React, { useMemo } from 'react';
import { Users, Plus, X } from 'lucide-react';
import { RegisteredAthleteSummary } from '@/app/actions/registrations';
import { sortCategories } from '@/lib/rules/judo-categories';

interface ReassignCategoryModalProps {
  athlete: RegisteredAthleteSummary | null;
  categories: Array<{ id: string; name: string; assigned_tatami_number?: number }>;
  targetCatId: string;
  onTargetCatIdChange: (id: string) => void;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onOpenNewCategory: () => void;
}

export function ReassignCategoryModal({
  athlete,
  categories,
  targetCatId,
  onTargetCatIdChange,
  isSubmitting,
  onConfirm,
  onClose,
  onOpenNewCategory,
}: ReassignCategoryModalProps) {
  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

  if (!athlete) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-amber-400" />
            <span>Reasignar Judoka a Otra Categoría</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <p className="text-white font-bold">{athlete.name}</p>
            <p className="text-slate-400 font-mono">
              RUT: {athlete.rut_dni} • Club: {athlete.club_name}
            </p>
            <p className="text-amber-400">
              Categoría actual: <span className="font-bold">{athlete.category_name}</span>
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Nueva Categoría de Destino
            </label>
            {sortedCategories.length > 0 ? (
              <select
                value={targetCatId}
                onChange={(e) => onTargetCatIdChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.id === athlete.category_id ? '(Actual)' : `(Tatami #${c.assigned_tatami_number || 1})`}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-amber-400 text-xs py-1 font-semibold">
                No hay categorías adicionales registradas en este campeonato.
              </p>
            )}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onOpenNewCategory}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 underline"
              >
                <Plus className="w-3 h-3" />
                <span>+ Crear o habilitar otra categoría de combate</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow"
          >
            {isSubmitting ? 'Reasignando...' : 'Confirmar Reasignación'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdditionalCategoryModalProps {
  athlete: RegisteredAthleteSummary | null;
  categories: Array<{ id: string; name: string; assigned_tatami_number?: number }>;
  alreadyRegisteredCategoryIds?: string[];
  targetCatId: string;
  onTargetCatIdChange: (id: string) => void;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function AdditionalCategoryModal({
  athlete,
  categories,
  alreadyRegisteredCategoryIds,
  targetCatId,
  onTargetCatIdChange,
  isSubmitting,
  onConfirm,
  onClose,
}: AdditionalCategoryModalProps) {
  if (!athlete) return null;

  const excludedIds = useMemo(
    () =>
      new Set(
        alreadyRegisteredCategoryIds && alreadyRegisteredCategoryIds.length > 0
          ? alreadyRegisteredCategoryIds
          : [athlete.category_id]
      ),
    [alreadyRegisteredCategoryIds, athlete.category_id]
  );

  const availableCategories = useMemo(
    () => sortCategories(categories.filter((c) => !excludedIds.has(c.id))),
    [categories, excludedIds]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center space-x-2">
            <Plus className="w-5 h-5 text-blue-400" />
            <span>Inscribir en Categoría Adicional</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <p className="text-white font-bold">{athlete.name}</p>
            <p className="text-slate-400 font-mono">
              RUT: {athlete.rut_dni} • Club: {athlete.club_name}
            </p>
            {athlete.birth_year && (
              <p className="text-slate-300">
                Año: <span className="font-mono text-white">{athlete.birth_year}</span> ({athlete.gender === 'M' ? 'Masculino' : 'Femenino'})
              </p>
            )}
            <p className="text-blue-400">
              Categoría inscrita actual:{' '}
              <span className="font-bold">{athlete.category_name}</span>
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Seleccionar Categoría Adicional Existente
            </label>
            {availableCategories.length > 0 ? (
              <select
                value={targetCatId}
                onChange={(e) => onTargetCatIdChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
              >
                <option value="">-- Elige una categoría del torneo --</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Tatami #{c.assigned_tatami_number || 1})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-amber-400 text-xs py-2 bg-slate-950/60 px-3 rounded-xl border border-slate-800">
                No hay otras categorías creadas disponibles en este campeonato.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              isSubmitting ||
              !targetCatId ||
              excludedIds.has(targetCatId)
            }
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition shadow flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{isSubmitting ? 'Inscribiendo...' : 'Confirmar Categoría Adicional'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
