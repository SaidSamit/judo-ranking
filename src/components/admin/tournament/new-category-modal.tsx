'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  JUDO_AGE_DIVISIONS,
  getWeightsForAgeDivision,
  getRecommendedDuration,
} from '@/lib/rules/judo-categories';

interface NewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    ageGroup: string;
    gender: 'M' | 'F' | 'MIXED';
    matchDurationSeconds: number;
  }) => Promise<void>;
}

export function NewCategoryModal({
  isOpen,
  onClose,
  onSubmit,
}: NewCategoryModalProps) {
  const [newCatName, setNewCatName] = useState('Senior Masculino -73kg');
  const [newCatAgeGroup, setNewCatAgeGroup] = useState('Senior');
  const [newCatGender, setNewCatGender] = useState<'M' | 'F' | 'MIXED'>('M');
  const [newCatWeight, setNewCatWeight] = useState('73');
  const [newCatDuration, setNewCatDuration] = useState('240');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: newCatName.trim(),
        ageGroup: newCatAgeGroup,
        gender: newCatGender,
        matchDurationSeconds: parseInt(newCatDuration, 10) || 240,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center space-x-2">
            <Plus className="w-5 h-5 text-amber-400" />
            <span>Nueva Categoría de Combate</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              required
              placeholder="ej: Senior Masculino -73kg"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                División de Edad
              </label>
              <select
                value={newCatAgeGroup}
                onChange={(e) => {
                  const newAge = e.target.value;
                  setNewCatAgeGroup(newAge);
                  const g = newCatGender === 'F' ? 'F' : 'M';
                  const weights = getWeightsForAgeDivision(newAge, g);
                  if (weights.length > 0) {
                    const parsedW = weights[0].replace(/[^0-9]/g, '');
                    setNewCatWeight(parsedW || '73');
                    const genStr = g === 'F' ? 'Femenino' : 'Masculino';
                    setNewCatName(`${newAge} ${genStr} ${weights[0]}`);
                  }
                  setNewCatDuration(String(getRecommendedDuration(newAge)));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {JUDO_AGE_DIVISIONS.map((div) => (
                  <option key={div.ageGroup} value={div.ageGroup}>
                    {div.ageGroup}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Género
              </label>
              <select
                value={newCatGender}
                onChange={(e) => {
                  const newG = e.target.value as 'M' | 'F' | 'MIXED';
                  setNewCatGender(newG);
                  const g = newG === 'F' ? 'F' : 'M';
                  const weights = getWeightsForAgeDivision(newCatAgeGroup, g);
                  if (weights.length > 0) {
                    const parsedW = weights[0].replace(/[^0-9]/g, '');
                    setNewCatWeight(parsedW || '73');
                    const genStr = g === 'F' ? 'Femenino' : 'Masculino';
                    setNewCatName(`${newCatAgeGroup} ${genStr} ${weights[0]}`);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="MIXED">Mixto</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Peso Límite (Oficial)
              </label>
              <select
                value={newCatWeight}
                onChange={(e) => {
                  const wVal = e.target.value;
                  setNewCatWeight(wVal);
                  const gStr = newCatGender === 'F' ? 'Femenino' : 'Masculino';
                  setNewCatName(`${newCatAgeGroup} ${gStr} -${wVal}kg`);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {getWeightsForAgeDivision(newCatAgeGroup, newCatGender === 'F' ? 'F' : 'M').map(
                  (w) => (
                    <option key={w} value={w.replace(/[^0-9]/g, '')}>
                      {w}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Duración del Combate (seg)
              </label>
              <input
                type="number"
                min="60"
                max="600"
                step="30"
                value={newCatDuration}
                onChange={(e) => setNewCatDuration(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
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
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow"
            >
              {isSubmitting ? 'Creando...' : 'Crear Categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

