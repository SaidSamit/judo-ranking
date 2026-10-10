// ==============================================================================
// VISTA: ESTACIÓN DE PESAJE OFICIAL (WEIGH-IN STATION)
// ==============================================================================
//
// REGLAS Y PROTOCOLO IJF:
// 1. Identificación por RUT / Nombre.
// 2. Verificación de peso real contra el tope oficial de la categoría.
// 3. Si excede el peso: alerta visual de exceso y sugerencia inteligente de la
//    categoría de peso superior inmediata dentro de su división y sexo.
// 4. Posibilidad de reclasificar al atleta o marcar DSQ si no da el peso.
// 5. Cierre formal del pesaje para desbloquear la generación de llaves en el
//    Panel del Director.
//
// ==============================================================================

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Users,
  Lock,
  Unlock,
  RotateCcw,
} from 'lucide-react';
import {
  getWeighInAthletesAction,
  recordAthleteWeightAction,
  WeighInAthlete,
} from '@/app/actions/weigh-in';
import {
  isWeightValidForCategory,
  getSuggestedUpperCategory,
  parseWeightLimitFromCategory,
} from '@/lib/rules/judo-categories';

export default function WeighInPage() {
  const [athletes, setAthletes] = useState<WeighInAthlete[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Estados de pesaje en edición por fila: { [registrationId]: weightString }
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});

  // Cargar atletas registrados
  useEffect(() => {
    async function loadAthletes() {
      setLoading(true);
      try {
        const res = await getWeighInAthletesAction();
        if (res.success && res.athletes.length > 0) {
          setAthletes(res.athletes);
        } else {
          // Datos iniciales de demostración para pruebas inmediatas si Supabase está vacío
          setAthletes([
            {
              registration_id: 'reg-demo-1',
              athlete_id: 'ath-demo-1',
              rut_dni: '19.876.543-2',
              name: 'Carlos Muñoz',
              club_name: 'Club de Judo Hiroshima',
              category_id: 'cat-cad-60',
              category_name: 'Cadetes (Sub-18) Masculino -60kg',
              gender: 'M',
              birth_year: 2009,
              actual_weight: 59.4,
              weigh_in_status: 'PASSED',
              weigh_in_at: new Date().toISOString(),
            },
            {
              registration_id: 'reg-demo-2',
              athlete_id: 'ath-demo-2',
              rut_dni: '20.123.456-7',
              name: 'Matías Silva',
              club_name: 'Judo Club Alto Hospicio',
              category_id: 'cat-cad-60',
              category_name: 'Cadetes (Sub-18) Masculino -60kg',
              gender: 'M',
              birth_year: 2009,
              actual_weight: null,
              weigh_in_status: 'PENDING',
            },
            {
              registration_id: 'reg-demo-3',
              athlete_id: 'ath-demo-3',
              rut_dni: '20.456.789-1',
              name: 'Joaquín Tapia',
              club_name: 'Club Dragones Arica',
              category_id: 'cat-cad-60',
              category_name: 'Cadetes (Sub-18) Masculino -60kg',
              gender: 'M',
              birth_year: 2009,
              actual_weight: 61.8, // Excede -60kg -> sugerirá -66kg
              weigh_in_status: 'PENDING',
            },
            {
              registration_id: 'reg-demo-4',
              athlete_id: 'ath-demo-4',
              rut_dni: '21.456.789-0',
              name: 'Valentina Rojas',
              club_name: 'Club de Judo Hiroshima',
              category_id: 'cat-sub15-48',
              category_name: 'Sub-15 Femenino -48kg',
              gender: 'F',
              birth_year: 2012,
              actual_weight: null,
              weigh_in_status: 'PENDING',
            },
          ]);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadAthletes();
  }, []);

  // Lista de categorías únicas presentes para filtrar
  const uniqueCategories = useMemo(() => {
    const map = new Map<string, string>();
    athletes.forEach((a) => map.set(a.category_id, a.category_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [athletes]);

  // Filtrado reactivo de atletas por búsqueda y categoría
  const filteredAthletes = useMemo(() => {
    return athletes.filter((a) => {
      const matchCat = selectedCategoryId === 'ALL' || a.category_id === selectedCategoryId;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.rut_dni.toLowerCase().includes(q) ||
        a.club_name.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [athletes, selectedCategoryId, searchQuery]);

  // Resumen del pesaje global
  const summary = useMemo(() => {
    const total = athletes.length;
    const passed = athletes.filter((a) => a.weigh_in_status === 'PASSED').length;
    const pending = athletes.filter((a) => a.weigh_in_status === 'PENDING').length;
    const dsq = athletes.filter((a) => a.weigh_in_status === 'DSQ').length;
    return { total, passed, pending, dsq };
  }, [athletes]);

  // Manejador: Registrar pesaje aprobado
  const handleApproveWeight = async (athlete: WeighInAthlete) => {
    const weightStr = weightInputs[athlete.registration_id] ?? String(athlete.actual_weight || '');
    const weightNum = parseFloat(weightStr);

    if (isNaN(weightNum) || weightNum <= 0) {
      setFeedback({ type: 'error', text: 'Por favor ingresa un peso válido en kg.' });
      return;
    }

    const check = isWeightValidForCategory(weightNum, athlete.category_name);
    if (!check.valid && !check.isPlus) {
      setFeedback({
        type: 'error',
        text: `El peso ${weightNum}kg supera el límite de ${check.limit}kg. Considera reclasificar a la categoría superior.`,
      });
      return;
    }

    setSavingId(athlete.registration_id);
    try {
      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: weightNum,
        status: 'PASSED',
      });

      // Actualizar estado local a 0ms
      setAthletes((prev) =>
        prev.map((a) =>
          a.registration_id === athlete.registration_id
            ? { ...a, actual_weight: weightNum, weigh_in_status: 'PASSED' }
            : a
        )
      );

      setFeedback({
        type: 'success',
        text: res.message || `Pesaje de ${athlete.name} aprobado (${weightNum}kg).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al guardar pesaje.' });
    } finally {
      setSavingId(null);
    }
  };

  // Manejador: Reclasificar a categoría superior sugerida
  const handleReclassify = async (athlete: WeighInAthlete, targetCategory: string) => {
    const weightStr = weightInputs[athlete.registration_id] ?? String(athlete.actual_weight || '');
    const weightNum = parseFloat(weightStr);

    if (isNaN(weightNum)) return;

    if (
      !confirm(
        `¿Reclasificar a ${athlete.name} (${weightNum}kg) de "${athlete.category_name}" a "${targetCategory}"?`
      )
    ) {
      return;
    }

    setSavingId(athlete.registration_id);
    try {
      const res = await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: weightNum,
        status: 'PASSED',
        newCategoryName: targetCategory,
      });

      setAthletes((prev) =>
        prev.map((a) =>
          a.registration_id === athlete.registration_id
            ? {
                ...a,
                actual_weight: weightNum,
                category_name: targetCategory,
                weigh_in_status: 'PASSED',
              }
            : a
        )
      );

      setFeedback({
        type: 'success',
        text: `Atleta ${athlete.name} reclasificado con éxito a ${targetCategory}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al reclasificar atleta.' });
    } finally {
      setSavingId(null);
    }
  };

  // Manejador: Descalificar (DSQ)
  const handleMarkDsq = async (athlete: WeighInAthlete) => {
    const weightStr = weightInputs[athlete.registration_id] ?? String(athlete.actual_weight || '');
    const weightNum = parseFloat(weightStr) || 0;

    if (!confirm(`¿Confirmar descalificación por peso (DSQ) para ${athlete.name}?`)) {
      return;
    }

    setSavingId(athlete.registration_id);
    try {
      await recordAthleteWeightAction({
        registrationId: athlete.registration_id,
        actualWeight: weightNum,
        status: 'DSQ',
      });

      setAthletes((prev) =>
        prev.map((a) =>
          a.registration_id === athlete.registration_id
            ? { ...a, actual_weight: weightNum, weigh_in_status: 'DSQ' }
            : a
        )
      );

      setFeedback({
        type: 'info',
        text: `Atleta ${athlete.name} marcado como DSQ (Descalificado).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al marcar DSQ.' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* CABECERA */}
      <header className="space-y-1 border-b border-slate-800/80 pb-5">
        <div className="flex items-center space-x-2">
          <Scale className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Estación de Pesaje Oficial</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Busca atletas por RUT o Nombre, registra su peso real certificado y confirma su
          aprobación (PASSED). Si un atleta excede el límite, el sistema sugiere automáticamente
          su ascenso a la categoría superior inmediata.
        </p>
      </header>

        {/* MÉTRICAS DE PESAJE */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 block font-bold">Total Inscritos</span>
            <span className="text-2xl font-black text-white mt-1 block">{summary.total}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-emerald-400 block font-bold">Aprobados (PASSED)</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">
              {summary.passed}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-amber-400 block font-bold">Pendientes</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">
              {summary.pending}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-red-400 block font-bold">Descalificados (DSQ)</span>
            <span className="text-2xl font-black text-red-400 mt-1 block">{summary.dsq}</span>
          </div>
        </section>

        {/* MENSAJES DE ESTADO */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-bold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-red-950/60 border-red-500 text-red-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* BARRA DE FILTROS Y BÚSQUEDA RÁPIDA POR RUT */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por RUT o Nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 flex-shrink-0">Categoría:</span>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">Todas las Categorías ({athletes.length})</option>
              {uniqueCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* TABLA DE ATLETAS EN PESAJE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">RUT</th>
                  <th className="px-4 py-3">Atleta / Club</th>
                  <th className="px-4 py-3">Categoría Registrada</th>
                  <th className="px-4 py-3">Peso Real (kg)</th>
                  <th className="px-4 py-3">Estado IJF</th>
                  <th className="px-4 py-3 text-right">Acciones de Pesaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAthletes.map((athlete) => {
                  const currentInput =
                    weightInputs[athlete.registration_id] ??
                    (athlete.actual_weight ? String(athlete.actual_weight) : '');
                  const currentWeightNum = parseFloat(currentInput);

                  // Evaluación de límites de peso
                  const hasWeight = !isNaN(currentWeightNum) && currentWeightNum > 0;
                  const weightCheck = hasWeight
                    ? isWeightValidForCategory(currentWeightNum, athlete.category_name)
                    : null;

                  const isOverweight = weightCheck && !weightCheck.valid && !weightCheck.isPlus;
                  const suggestedCategory = isOverweight
                    ? getSuggestedUpperCategory(athlete.category_name, currentWeightNum)
                    : null;

                  return (
                    <tr
                      key={athlete.registration_id}
                      className={`hover:bg-slate-800/40 transition ${
                        isOverweight ? 'bg-red-950/20' : ''
                      }`}
                    >
                      {/* RUT */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">
                        {athlete.rut_dni}
                      </td>

                      {/* Nombre y Club */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-white block text-sm">{athlete.name}</span>
                        <span className="text-[11px] text-slate-400 block">{athlete.club_name}</span>
                      </td>

                      {/* Categoría Oficial */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-amber-300 block">
                          {athlete.category_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Año {athlete.birth_year} • {athlete.gender === 'M' ? 'Masc' : 'Fem'}
                        </span>
                      </td>

                      {/* Input de Peso Real */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={currentInput}
                            onChange={(e) =>
                              setWeightInputs((prev) => ({
                                ...prev,
                                [athlete.registration_id]: e.target.value,
                              }))
                            }
                            className={`w-20 px-2 py-1.5 rounded-lg text-sm font-mono text-center font-bold focus:outline-none ${
                              isOverweight
                                ? 'bg-red-950/80 border border-red-500 text-red-200'
                                : weightCheck?.valid
                                ? 'bg-emerald-950/60 border border-emerald-500 text-emerald-200'
                                : 'bg-slate-950 border border-slate-700 text-white'
                            }`}
                          />
                          <span className="text-slate-400 text-xs font-mono">kg</span>
                        </div>

                        {/* Alerta de Sobrepeso y Sugerencia de Reclasificación */}
                        {isOverweight && (
                          <div className="mt-1 text-[11px] text-red-400 font-bold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            <span>
                              Exceso: +{weightCheck.diff}kg (Límite: {weightCheck.limit}kg)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            athlete.weigh_in_status === 'PASSED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : athlete.weigh_in_status === 'DSQ'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {athlete.weigh_in_status === 'PASSED'
                            ? 'Aprobado'
                            : athlete.weigh_in_status === 'DSQ'
                            ? 'Descalificado'
                            : 'Pendiente'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right space-x-2">
                        {isOverweight && suggestedCategory && (
                          <button
                            type="button"
                            onClick={() => handleReclassify(athlete, suggestedCategory)}
                            disabled={savingId === athlete.registration_id}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition shadow inline-flex items-center space-x-1"
                            title={`Reclasificar a ${suggestedCategory}`}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Subir a {suggestedCategory.split(' ').slice(-1)[0]}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleApproveWeight(athlete)}
                          disabled={savingId === athlete.registration_id || !hasWeight}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition inline-flex items-center space-x-1 ${
                            athlete.weigh_in_status === 'PASSED'
                              ? 'bg-slate-800 text-emerald-400 border border-emerald-900/60'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{athlete.weigh_in_status === 'PASSED' ? 'Actualizar' : 'Aprobar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMarkDsq(athlete)}
                          disabled={savingId === athlete.registration_id}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 transition inline-flex items-center space-x-1 text-[11px]"
                          title="Descalificar (DSQ)"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DSQ</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
