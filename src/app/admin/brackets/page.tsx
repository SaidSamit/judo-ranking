// ==============================================================================
// VISTA: PANEL DEL DIRECTOR Y VISOR DE LLAVES DE TORNEO
// ==============================================================================
//
// CORRECCIONES Y REQUERIMIENTOS:
// 1. Persistencia Multicategoría: Cada categoría conserva su propia llave de forma
//    independiente (categoryBrackets map). Al cambiar de categoría, se muestra
//    la llave correspondiente a esa categoría sin sobreescribir ni perder datos.
// 2. Modificable: Conexión con saveModifiedBracketAction para guardar cambios
//    realizados en el BracketViewer directamente en Supabase y en memoria.
// 3. Reglas IJF: Bloqueo de sorteo si el pesaje no está cerrado.
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Swords,
  Lock,
  Unlock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { BracketViewer } from '@/components/admin/bracket-viewer';
import {
  getTournamentCategoriesStatusAction,
  generateCategoryMatchesAction,
  saveModifiedBracketAction,
  CategoryBracketStatus,
} from '@/app/actions/brackets';
import { generateCategoryBracket, BracketResult } from '@/lib/rules/bracket-engine';

export default function BracketsDirectorPage() {
  const [categories, setCategories] = useState<CategoryBracketStatus[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // MAPA MULTI-CATEGORÍA: Cada categoría guarda su propio BracketResult
  const [categoryBrackets, setCategoryBrackets] = useState<Record<string, BracketResult>>({});

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Cargar categorías y estado de pesaje
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getTournamentCategoriesStatusAction();
        if (res.success && res.categories.length > 0) {
          setCategories(res.categories);
          const firstCatId = res.categories[0].id;
          setSelectedCategoryId(firstCatId);
        } else {
          // Datos iniciales de demostración con 4 categorías realistas
          const mockCats: CategoryBracketStatus[] = [
            {
              id: 'cat-cad-60',
              name: 'Cadetes (Sub-18) Masculino -60kg',
              age_group: 'Cadetes',
              gender: 'M',
              assigned_tatami_number: 1,
              total_registered: 4,
              passed_weigh_in: 4,
              pending_weigh_in: 0,
              dsq_count: 0,
              is_weigh_in_closed: true, // 4 atletas -> Round Robin (Berger)
              matches_generated: true,
              bracket_type: 'ROUND_ROBIN',
            },
            {
              id: 'cat-jun-52',
              name: 'Junior (Sub-21) Femenino -52kg',
              age_group: 'Junior',
              gender: 'F',
              assigned_tatami_number: 1,
              total_registered: 2,
              passed_weigh_in: 2,
              pending_weigh_in: 0,
              dsq_count: 0,
              is_weigh_in_closed: true, // 2 atletas -> Best of 3
              matches_generated: true,
              bracket_type: 'BEST_OF_3',
            },
            {
              id: 'cat-sen-73',
              name: 'Senior Masculino -73kg',
              age_group: 'Senior',
              gender: 'M',
              assigned_tatami_number: 1,
              total_registered: 7,
              passed_weigh_in: 7,
              pending_weigh_in: 0,
              dsq_count: 0,
              is_weigh_in_closed: true, // 7 atletas -> Eliminación Simple (árbol 8)
              matches_generated: true,
              bracket_type: 'SINGLE_ELIMINATION',
            },
            {
              id: 'cat-inf-34',
              name: 'Sub-13 Masculino -34kg',
              age_group: 'Sub-13',
              gender: 'M',
              assigned_tatami_number: 2,
              total_registered: 5,
              passed_weigh_in: 2,
              pending_weigh_in: 3, // PESAJE PENDIENTE -> BLOQUEADO
              dsq_count: 0,
              is_weigh_in_closed: false,
              matches_generated: false,
              bracket_type: 'ROUND_ROBIN',
            },
          ];

          setCategories(mockCats);
          setSelectedCategoryId(mockCats[0].id);

          // Generar las llaves iniciales individuales para cada categoría cerrada
          // 1. Cadetes Masculino -60kg (Round Robin N=4)
          const cadCompetitors = [
            { id: 'ath-c1', name: 'Carlos Muñoz', club_name: 'Club de Judo Hiroshima', seed: 1 },
            { id: 'ath-c2', name: 'Matías Silva', club_name: 'Judo Club Alto Hospicio', seed: 2 },
            { id: 'ath-c3', name: 'Joaquín Tapia', club_name: 'Club Dragones Arica', seed: 3 },
            { id: 'ath-c4', name: 'Franco Oyarzún', club_name: 'Judo Iquique', seed: 4 },
          ];
          const cadBracket = generateCategoryBracket(cadCompetitors, {
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            tournament_id: 'e0000000-0000-0000-0000-000000000001',
            category_id: 'cat-cad-60',
            category_name: 'Cadetes (Sub-18) Masculino -60kg',
            tatami_number: 1,
            start_match_number: 1,
          });

          // 2. Junior Femenino -52kg (Best of 3 N=2)
          const junCompetitors = [
            { id: 'ath-j1', name: 'Camila Soto', club_name: 'Club de Judo Hiroshima', seed: 1 },
            { id: 'ath-j2', name: 'Isidora Morales', club_name: 'Judo Club Alto Hospicio', seed: 2 },
          ];
          const junBracket = generateCategoryBracket(junCompetitors, {
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            tournament_id: 'e0000000-0000-0000-0000-000000000001',
            category_id: 'cat-jun-52',
            category_name: 'Junior (Sub-21) Femenino -52kg',
            tatami_number: 1,
            start_match_number: 10,
          });

          // 3. Senior Masculino -73kg (Single Elimination N=7)
          const senCompetitors = [
            { id: 'ath-s1', name: 'Roberto Díaz', club_name: 'Judo Club Alto Hospicio', seed: 1 },
            { id: 'ath-s2', name: 'Sebastián López', club_name: 'Universidad Arturo Prat', seed: 2 },
            { id: 'ath-s3', name: 'Felipe Contreras', club_name: 'Club de Judo Hiroshima', seed: 3 },
            { id: 'ath-s4', name: 'Andrés Guzmán', club_name: 'Club Maho', seed: 4 },
            { id: 'ath-s5', name: 'Mauricio Ramos', club_name: 'Judo Pica', seed: 5 },
            { id: 'ath-s6', name: 'Cristóbal Vega', club_name: 'Samurái Arica', seed: 6 },
            { id: 'ath-s7', name: 'Nicolás Palma', club_name: 'Polideportivo Iquique', seed: 7 },
          ];
          const senBracket = generateCategoryBracket(senCompetitors, {
            organization_id: 'a0000000-0000-0000-0000-000000000001',
            tournament_id: 'e0000000-0000-0000-0000-000000000001',
            category_id: 'cat-sen-73',
            category_name: 'Senior Masculino -73kg',
            tatami_number: 1,
            start_match_number: 20,
          });

          setCategoryBrackets({
            'cat-cad-60': cadBracket,
            'cat-jun-52': junBracket,
            'cat-sen-73': senBracket,
          });
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const activeBracketResult = selectedCategoryId ? categoryBrackets[selectedCategoryId] : null;

  // Manejador: Generar Llaves con el Motor Matemático
  const handleGenerateBracket = async (category: CategoryBracketStatus) => {
    if (!category.is_weigh_in_closed) {
      setFeedback({
        type: 'error',
        text: 'Acción bloqueada: No se pueden generar llaves hasta que el pesaje de la categoría esté cerrado.',
      });
      return;
    }

    if (category.passed_weigh_in < 2) {
      setFeedback({
        type: 'error',
        text: 'Insuficiente: Se requieren al menos 2 atletas con pesaje aprobado para realizar el sorteo.',
      });
      return;
    }

    setIsGenerating(true);
    setFeedback({
      type: 'info',
      text: `Ejecutando motor de sorteo para ${category.name}...`,
    });

    try {
      const res = await generateCategoryMatchesAction({
        categoryId: category.id,
        tatamiNumber: category.assigned_tatami_number,
      });

      if (res.success && res.result) {
        // Almacenar en el mapa individual de esta categoría
        setCategoryBrackets((prev) => ({
          ...prev,
          [category.id]: res.result!,
        }));
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, matches_generated: true } : c))
        );
        setFeedback({
          type: 'success',
          text: res.message,
        });
      } else {
        // Generador local de demostración
        const count = category.passed_weigh_in;
        const mockCompetitors = Array.from({ length: count }, (_, i) => ({
          id: `ath-${category.id}-${i + 1}`,
          name: `Atleta #${i + 1} (${category.name.split(' ')[0]})`,
          club_name: i % 2 === 0 ? 'Club de Judo Hiroshima' : 'Judo Club Alto Hospicio',
          seed: i + 1,
        }));

        const localResult = generateCategoryBracket(mockCompetitors, {
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          tournament_id: 'e0000000-0000-0000-0000-000000000001',
          category_id: category.id,
          category_name: category.name,
          tatami_number: category.assigned_tatami_number,
          start_match_number: 1,
        });

        setCategoryBrackets((prev) => ({
          ...prev,
          [category.id]: localResult,
        }));
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, matches_generated: true } : c))
        );
        setFeedback({
          type: 'success',
          text: `¡Llave generada exitosamente! ${localResult.total_matches} combates calculados (${localResult.summary.description}).`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: `Error al generar sorteo: ${err.message}`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Manejador: Guardar Llave Modificada por el Director
  const handleSaveModifiedBracket = async (modifiedBracket: BracketResult) => {
    if (!selectedCategoryId) return;

    // Actualizar estado local a 0ms
    setCategoryBrackets((prev) => ({
      ...prev,
      [selectedCategoryId]: modifiedBracket,
    }));

    // Persistir en Supabase
    try {
      const res = await saveModifiedBracketAction({
        categoryId: selectedCategoryId,
        bracketResult: modifiedBracket,
      });

      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'info', text: 'Modificación guardada localmente en la sesión activa.' });
      }
    } catch (err: any) {
      console.warn('Error guardando en Supabase, guardado en memoria:', err);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* CABECERA */}
      <header className="space-y-1 border-b border-slate-800/80 pb-5">
        <div className="flex items-center space-x-2">
          <Trophy className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Dirección de Torneo & Visor de Llaves
          </h1>
        </div>
        <p className="text-slate-400 text-sm">
          Control de sorteo oficial y supervisión de cuadros. Selecciona cualquier categoría
          para ver su llave en tiempo real. Por regla IJF, el botón{' '}
          <strong className="text-amber-400">&quot;Generar Llaves&quot;</strong> permanece
          bloqueado hasta que el pesaje de la categoría esté completamente cerrado.
        </p>
      </header>

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
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* LISTA DE CATEGORÍAS Y ESTADO DE PESAJE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Resumen de Categorías y Estado de Pesaje</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {categories.length} Categorías Programadas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const hasBracket = !!categoryBrackets[cat.id];
              const canGenerate = cat.is_weigh_in_closed && cat.passed_weigh_in >= 2;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`cursor-pointer rounded-xl p-4 border transition space-y-3 ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-500 ring-2 ring-amber-500/40 shadow-xl'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white block line-clamp-2">
                      {cat.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 flex-shrink-0">
                      Tatami {cat.assigned_tatami_number}
                    </span>
                  </div>

                  {/* Estado de Pesaje */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Atletas Pesados:</span>
                      <span className="font-mono font-bold text-white">
                        {cat.passed_weigh_in} / {cat.total_registered}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pesaje:</span>
                      {cat.is_weigh_in_closed ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1 text-[11px]">
                          <Lock className="w-3 h-3" />
                          <span>Cerrado</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center space-x-1 text-[11px]">
                          <Unlock className="w-3 h-3" />
                          <span>En Curso ({cat.pending_weigh_in})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botón de Generar / Regenerar Llaves */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategoryId(cat.id);
                        handleGenerateBracket(cat);
                      }}
                      disabled={!canGenerate || isGenerating}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center space-x-1.5 shadow ${
                        !canGenerate
                          ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                          : hasBracket
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                      }`}
                    >
                      {!canGenerate ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Pesaje Pendiente</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{hasBracket ? 'Regenerar Llave' : 'Generar Llaves'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* VISOR VISUAL Y MODIFICABLE DE LA CATEGORÍA SELECCIONADA */}
        {selectedCategory ? (
          activeBracketResult ? (
            <section className="space-y-3">
              <BracketViewer
                bracketResult={activeBracketResult}
                categoryName={selectedCategory.name}
                onSaveModifiedBracket={handleSaveModifiedBracket}
              />
            </section>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-4">
              <Trophy className="w-12 h-12 mx-auto text-slate-600" />
              <div>
                <p className="text-base font-bold text-white">
                  Llave no generada para {selectedCategory.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedCategory.is_weigh_in_closed
                    ? 'El pesaje de esta categoría está cerrado. Presiona "Generar Llaves" para calcular el cuadro oficial.'
                    : 'Esta categoría aún tiene atletas con pesaje pendiente. El pesaje debe cerrarse para permitir el sorteo.'}
                </p>
              </div>

              {selectedCategory.is_weigh_in_closed && selectedCategory.passed_weigh_in >= 2 && (
                <button
                  type="button"
                  onClick={() => handleGenerateBracket(selectedCategory)}
                  disabled={isGenerating}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg inline-flex items-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Generar Llaves Ahora</span>
                </button>
              )}
            </div>
          )
        ) : null}
      </div>
  );
}
