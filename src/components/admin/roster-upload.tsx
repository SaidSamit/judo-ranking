// ==============================================================================
// COMPONENTE: MÓDULO DE INSCRIPCIÓN Y BORRADOR DE NÓMINA (DRAFT STATE PATTERN)
// ==============================================================================
//
// REGLAS DE NEGOCIO Y ACREDITACIÓN APLICADAS:
// 1. RUT / DNI Obligatorio y Principal: Primer campo del formulario con autofocus.
// 2. Menú Desplegable de Categorías: Selección restringida a estándares oficiales.
// 3. Año de Nacimiento Obligatorio: Determina matemáticamente la división etaria
//    (Sub-11, Sub-13, Sub-15, Cadetes Sub-18, Junior Sub-21, Senior, Master).
// 4. Filtrado Reactivo por Edad y Sexo: El dropdown de categorías solo muestra los
//    pesos oficiales según el año de nacimiento y género del atleta.
// 5. Exclusión de Peso en Acreditación: El pesaje se captura exclusivamente en la
//    Estación de Pesaje (WEIGH_IN), manteniendo la acreditación ágil y limpia.
// 6. Patrón Estado Borrador (Draft State): Toda la nómina se valida localmente a 0ms
//    y se compromete en Supabase mediante un Server Action masivo y atómico.
//
// ==============================================================================

'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Plus,
  Upload,
  Trash2,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  Users,
  Save,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { confirmRegistrationsAction, DraftAthletePayload } from '@/app/actions/registrations';
import {
  getDivisionByBirthYear,
  getAvailableCategoriesForAthlete,
  getAllPossibleCategories,
} from '@/lib/rules/judo-categories';

export interface DraftAthlete {
  id: string; // ID local temporal
  rut_dni: string; // Obligatorio y clave única
  name: string;
  club_name: string;
  birth_year: number; // Obligatorio
  gender: 'M' | 'F';
  category: string; // Seleccionada del dropdown
  seed?: number;
}

interface CategorySummary {
  name: string;
  count: number;
  bracketType: 'BEST_OF_3' | 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'INSUFFICIENT';
  bracketTypeLabel: string;
}

interface RosterUploadProps {
  organizationId?: string;
  tournamentId?: string;
  onRegistrationsConfirmed?: (count: number) => void;
}

export function RosterUpload({
  organizationId = 'a0000000-0000-0000-0000-000000000001',
  tournamentId = 'e0000000-0000-0000-0000-000000000001',
  onRegistrationsConfirmed,
}: RosterUploadProps) {
  const currentYear = new Date().getFullYear();

  // 1. ESTADO BORRADOR PRINCIPAL (FUENTE LOCAL DE VERDAD)
  const [draftAthletes, setDraftAthletes] = useState<DraftAthlete[]>([
    {
      id: 'demo-1',
      rut_dni: '19.876.543-2',
      name: 'Carlos Muñoz',
      club_name: 'Club Judo Iquique',
      birth_year: 2009,
      gender: 'M',
      category: 'Cadetes (Sub-18) Masculino -60kg',
      seed: 1,
    },
    {
      id: 'demo-2',
      rut_dni: '20.123.456-7',
      name: 'Matías Silva',
      club_name: 'Judo Club Alto Hospicio',
      birth_year: 2009,
      gender: 'M',
      category: 'Cadetes (Sub-18) Masculino -60kg',
      seed: 2,
    },
  ]);

  // 2. FORMULARIO MANUAL ÁGIL (RUT ES EL CAMPO PRINCIPAL Y OBLIGATORIO)
  const [formRut, setFormRut] = useState('');
  const [formName, setFormName] = useState('');
  const [formClub, setFormClub] = useState('');
  const [formBirthYear, setFormBirthYear] = useState<number | ''>(2009);
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formCategory, setFormCategory] = useState('');

  // 3. ESTADOS DE EDICIÓN EN LÍNEA
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DraftAthlete | null>(null);

  // 4. ESTADOS DE CSV & ENVÍO
  const [showCsvDropzone, setShowCsvDropzone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const rutInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // CÁLCULO DINÁMICO DE CATEGORÍAS SEGÚN AÑO DE NACIMIENTO Y GÉNERO
  // ============================================================================
  const availableDivInfo = useMemo(() => {
    if (!formBirthYear || typeof formBirthYear !== 'number' || isNaN(formBirthYear)) {
      return { divisionName: '', categories: [] };
    }
    return getAvailableCategoriesForAthlete(formBirthYear, formGender, currentYear);
  }, [formBirthYear, formGender, currentYear]);

  // Sincronizar automáticamente la categoría seleccionada cuando cambian las opciones disponibles
  useEffect(() => {
    if (availableDivInfo.categories.length > 0) {
      if (!availableDivInfo.categories.includes(formCategory)) {
        setFormCategory(availableDivInfo.categories[0]);
      }
    } else {
      setFormCategory('');
    }
  }, [availableDivInfo.categories, formCategory]);

  // ============================================================================
  // ACCIÓN 1: AGREGAR ATLETA MANUALMENTE AL BORRADOR
  // ============================================================================
  const handleAddManualAthlete = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Validación de RUT obligatorio
    const cleanRut = formRut.trim();
    if (!cleanRut) {
      setFeedbackMessage({
        type: 'error',
        text: 'El RUT es obligatorio.',
      });
      rutInputRef.current?.focus();
      return;
    }

    // 2. Validación de Nombre obligatorio
    const cleanName = formName.trim();
    if (!cleanName) {
      setFeedbackMessage({
        type: 'error',
        text: 'Por favor, ingresa el Nombre Completo del atleta.',
      });
      nameInputRef.current?.focus();
      return;
    }

    // 3. Validación de Año de Nacimiento obligatorio
    const birthYearNum =
      typeof formBirthYear === 'number'
        ? formBirthYear
        : parseInt(String(formBirthYear), 10);

    if (
      !birthYearNum ||
      isNaN(birthYearNum) ||
      birthYearNum < 1940 ||
      birthYearNum > currentYear
    ) {
      setFeedbackMessage({
        type: 'error',
        text: `El Año de Nacimiento es obligatorio y debe estar entre 1940 y ${currentYear}.`,
      });
      return;
    }

    // 4. Validación de Categoría desplegable
    const cleanCategory = formCategory.trim();
    if (!cleanCategory) {
      setFeedbackMessage({
        type: 'error',
        text: 'Debes seleccionar una Categoría del menú desplegable.',
      });
      return;
    }

    // Verificar si el RUT ya existe en el borrador
    const alreadyExists = draftAthletes.some(
      (a) =>
        a.rut_dni.replace(/[.\-\s]/g, '').toUpperCase() ===
        cleanRut.replace(/[.\-\s]/g, '').toUpperCase()
    );

    if (alreadyExists) {
      setFeedbackMessage({
        type: 'error',
        text: `El atleta con RUT "${cleanRut}" ya se encuentra en el borrador temporal.`,
      });
      rutInputRef.current?.focus();
      return;
    }

    const cleanClub = formClub.trim() || 'Independiente';

    const newAthlete: DraftAthlete = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rut_dni: cleanRut,
      name: cleanName,
      club_name: cleanClub,
      birth_year: birthYearNum,
      gender: formGender,
      category: cleanCategory,
    };

    setDraftAthletes((prev) => [newAthlete, ...prev]);

    // Limpiar campos clave y retornar el foco a RUT para carga en serie ultra rápida
    setFormRut('');
    setFormName('');
    setFeedbackMessage({
      type: 'info',
      text: `Atleta "${cleanName}" (${cleanCategory}) agregado al borrador.`,
    });

    rutInputRef.current?.focus();
  };

  // ============================================================================
  // ACCIÓN 2: IMPORTAR CSV MASIVAMENTE Y ANEXAR AL BORRADOR
  // ============================================================================
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: DraftAthlete[] = [];

        results.data.forEach((row, idx) => {
          const rawRut = (
            row.rut ||
            row.dni ||
            row.rut_dni ||
            row.identificacion ||
            `TEMP-${Date.now().toString().slice(-4)}-${idx + 1}`
          ).trim();

          const rawName = (row.nombre || row.name || row.atleta || '').trim();
          const rawLastName = (row.apellido || row.last_name || '').trim();
          const fullName = rawLastName ? `${rawName} ${rawLastName}` : rawName;
          if (!fullName) return; // Omitir filas sin nombre

          const club = (row.club || row.equipo || row.club_name || 'Independiente').trim();

          const rawGender = (row.genero || row.sexo || row.gender || 'M').toString().toUpperCase();
          const gender: 'M' | 'F' = rawGender.startsWith('F') ? 'F' : 'M';

          // Año de nacimiento
          let birthYear = parseInt(
            row.ano || row.anio || row.año || row.birth_year || row.ano_nacimiento || '',
            10
          );
          if (isNaN(birthYear) || birthYear < 1940 || birthYear > currentYear) {
            birthYear = 2008; // Valor por defecto en CSV si viene ausente
          }

          // Categoría (si no viene o no coincide, calcular por edad y sexo)
          let category = (row.categoria || row.category || row.division || '').trim();
          if (!category) {
            const computed = getAvailableCategoriesForAthlete(birthYear, gender, currentYear);
            category = computed.categories[0] || 'Senior Masculino -60kg';
          }

          imported.push({
            id: `csv-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            rut_dni: rawRut,
            name: fullName,
            club_name: club,
            birth_year: birthYear,
            gender,
            category,
          });
        });

        if (imported.length > 0) {
          setDraftAthletes((prev) => [...imported, ...prev]);
          setFeedbackMessage({
            type: 'success',
            text: `Se importaron ${imported.length} atletas del CSV y se agregaron a la tabla borrador.`,
          });
          setShowCsvDropzone(false);
        } else {
          setFeedbackMessage({
            type: 'error',
            text: 'No se encontraron filas válidas en el archivo CSV.',
          });
        }

        if (csvInputRef.current) csvInputRef.current.value = '';
      },
      error: (err) => {
        setFeedbackMessage({
          type: 'error',
          text: `Error procesando el archivo CSV: ${err.message}`,
        });
      },
    });
  };

  // ============================================================================
  // ACCIÓN 3: GESTIÓN DE FILAS EN LA TABLA BORRADOR (EDITAR / ELIMINAR)
  // ============================================================================
  const handleDeleteRow = (id: string) => {
    setDraftAthletes((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleStartEdit = (athlete: DraftAthlete) => {
    setEditingId(athlete.id);
    setEditForm({ ...athlete });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;

    if (!editForm.rut_dni.trim()) {
      alert('El RUT es obligatorio.');
      return;
    }
    if (!editForm.name.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }

    setDraftAthletes((prev) =>
      prev.map((a) => (a.id === editForm.id ? { ...editForm } : a))
    );
    setEditingId(null);
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de que deseas vaciar toda la tabla borrador?')) {
      setDraftAthletes([]);
      setFeedbackMessage({ type: 'info', text: 'Borrador vaciado completamente.' });
    }
  };

  // ============================================================================
  // ACCIÓN 4: ENVÍO MASIVO A BASE DE DATOS (SERVER ACTION)
  // ============================================================================
  const handleConfirmRegistrations = async () => {
    if (draftAthletes.length === 0) return;

    setIsSubmitting(true);
    setFeedbackMessage({ type: 'info', text: 'Guardando nómina en Supabase...' });

    try {
      const payload: DraftAthletePayload[] = draftAthletes.map((a) => ({
        id: a.id,
        rut_dni: a.rut_dni,
        name: a.name,
        club_name: a.club_name,
        category: a.category,
        gender: a.gender,
        birth_year: a.birth_year,
        seed: a.seed,
      }));

      const res = await confirmRegistrationsAction(payload, organizationId, tournamentId);

      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: res.message || `¡Éxito! Se confirmaron ${res.count} inscripciones en la base de datos.`,
        });
        if (onRegistrationsConfirmed) {
          onRegistrationsConfirmed(res.count);
        }
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || res.error || 'Ocurrió un error al confirmar inscripciones.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Error de conexión: ${err.message || 'Fallo inesperado al ejecutar Server Action'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Diagnóstico de llaves por categoría
  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, number>();
    draftAthletes.forEach((a) => {
      const cat = a.category.trim();
      map.set(cat, (map.get(cat) || 0) + 1);
    });

    return Array.from(map.entries()).map(([name, count]) => {
      let bracketType: CategorySummary['bracketType'] = 'SINGLE_ELIMINATION';
      let bracketTypeLabel = 'Eliminación Simple';

      if (count < 2) {
        bracketType = 'INSUFFICIENT';
        bracketTypeLabel = 'Insuficiente (<2)';
      } else if (count === 2) {
        bracketType = 'BEST_OF_3';
        bracketTypeLabel = 'Al Mejor de 3';
      } else if (count >= 3 && count <= 5) {
        bracketType = 'ROUND_ROBIN';
        bracketTypeLabel = 'Round Robin (Berger)';
      } else {
        bracketType = 'SINGLE_ELIMINATION';
        bracketTypeLabel = `Eliminación Simple (N=${count})`;
      }

      return { name, count, bracketType, bracketTypeLabel };
    });
  }, [draftAthletes]);

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans">
      {/* ==================================================================== */}
      {/* 1. UI PRINCIPAL: FORMULARIO MANUAL ÁGIL (RUT ES EL CAMPO PRINCIPAL) */}
      {/* ==================================================================== */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>Acreditación Rápida de Atletas</span>
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono">
                Modo Borrador
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              El <strong className="text-slate-200">RUT</strong> y el{' '}
              <strong className="text-slate-200">Año de Nacimiento</strong> son obligatorios. Las
              categorías se filtran automáticamente según la edad y el sexo. El pesaje se realiza
              en la estación de pesaje.
            </p>
          </div>

          {/* BOTÓN SECUNDARIO: ABRIR IMPORTACIÓN CSV */}
          <button
            type="button"
            onClick={() => setShowCsvDropzone((prev) => !prev)}
            className="flex items-center space-x-2 text-xs px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition font-bold"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>{showCsvDropzone ? 'Ocultar Carga CSV' : 'Importar CSV de Respaldo'}</span>
          </button>
        </div>

        {/* ÁREA DESPLEGABLE DE CSV (UI SECUNDARIA) */}
        {showCsvDropzone && (
          <div className="p-4 bg-slate-950/80 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="text-sm font-bold text-white block">
                  Carga Masiva desde CSV
                </span>
                <span className="text-xs text-slate-400 block">
                  Columnas admitidas: rut, nombre, apellido, club, ano_nacimiento, genero, categoria.
                </span>
              </div>
            </div>

            <label className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 flex-shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Seleccionar Archivo</span>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleCsvImport}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* FORMULARIO MANUAL: RUT PRIMERO, CATEGORÍA DROPDOWN, SIN PESO */}
        <form onSubmit={handleAddManualAthlete} className="space-y-4 pt-1">
          {/* FILA 1: RUT, NOMBRE, CLUB */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* 1. RUT: CAMPO OBLIGATORIO */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                RUT <span className="text-red-400">*</span>
              </label>
              <input
                ref={rutInputRef}
                type="text"
                placeholder="Ej: 19.876.543-2"
                value={formRut}
                onChange={(e) => setFormRut(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono"
                autoFocus
              />
            </div>

            {/* 2. Nombre Completo */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nombre Completo <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Ej: Matías González"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {/* 3. Club / Delegación */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Club / Delegación
              </label>
              <input
                type="text"
                placeholder="Ej: Club de Judo Hiroshima"
                value={formClub}
                onChange={(e) => setFormClub(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* FILA 2: AÑO NACIMIENTO (OBLIGATORIO), GÉNERO, CATEGORÍA DROPDOWN, BOTÓN AGREGAR */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* 4. Año de Nacimiento (Obligatorio) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Año Nac.</span>
                <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={1940}
                max={currentYear}
                placeholder="Ej: 2010"
                value={formBirthYear}
                onChange={(e) =>
                  setFormBirthYear(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* 5. Género (M / F) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Género
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormGender('M')}
                  className={`py-1.5 rounded text-xs font-bold transition text-center ${
                    formGender === 'M'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Masc (M)
                </button>
                <button
                  type="button"
                  onClick={() => setFormGender('F')}
                  className={`py-1.5 rounded text-xs font-bold transition text-center ${
                    formGender === 'F'
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fem (F)
                </button>
              </div>
            </div>

            {/* 6. Categoría: MENÚ DESPLEGABLE FILTRADO DINÁMICAMENTE POR EDAD Y GÉNERO */}
            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Categorías Oficiales</span>
                  <span className="text-red-400">*</span>
                </label>
                {availableDivInfo.divisionName && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {availableDivInfo.divisionName} (
                    {typeof formBirthYear === 'number'
                      ? `${currentYear - formBirthYear} años`
                      : ''}
                    )
                  </span>
                )}
              </div>

              <div className="relative">
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 appearance-none pr-8 cursor-pointer"
                >
                  {availableDivInfo.categories.length === 0 ? (
                    <option value="">Ingresa el año de nacimiento...</option>
                  ) : (
                    availableDivInfo.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 7. Botón de Agregar al Borrador */}
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* MENSAJES DE ESTADO */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-bold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
              : feedbackMessage.type === 'error'
              ? 'bg-red-950/60 border-red-500 text-red-300'
              : 'bg-slate-900 border-slate-700 text-slate-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : feedbackMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <Users className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. TABLA BORRADOR: GESTIÓN LOCAL (VER, EDITAR, ELIMINAR) */}
      {/* ==================================================================== */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-base font-black text-white flex items-center space-x-2">
              <span>Nómina en Borrador</span>
              <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono">
                {draftAthletes.length} atletas
              </span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {draftAthletes.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 transition flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Borrador</span>
              </button>
            )}

            {/* BOTÓN FINAL DE ENVÍO MASIVO */}
            <button
              type="button"
              onClick={handleConfirmRegistrations}
              disabled={draftAthletes.length === 0 || isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center space-x-2 ${
                draftAthletes.length === 0
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : isSubmitting
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Confirmando en BD...'
                  : `Confirmar Inscripciones (${draftAthletes.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* TABLA DE ATLETAS */}
        {draftAthletes.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold">No hay atletas en el borrador temporal.</p>
            <p className="text-xs">Usa el formulario superior para añadir atletas o importa un archivo CSV.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">RUT</th>
                  <th className="px-4 py-3">Nombre Atleta</th>
                  <th className="px-4 py-3">Club / Escuela</th>
                  <th className="px-4 py-3">Año (Edad)</th>
                  <th className="px-4 py-3">Género</th>
                  <th className="px-4 py-3">Categoría Oficial</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {draftAthletes.map((athlete, idx) => {
                  const isEditing = editingId === athlete.id;

                  if (isEditing && editForm) {
                    // FILA EN MODO EDICIÓN
                    const editAvailable = getAvailableCategoriesForAthlete(
                      editForm.birth_year,
                      editForm.gender,
                      currentYear
                    );

                    return (
                      <tr key={athlete.id} className="bg-amber-950/20">
                        <td className="px-4 py-3 font-mono text-slate-500">{idx + 1}</td>
                        {/* Editar RUT */}
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.rut_dni}
                            onChange={(e) =>
                              setEditForm({ ...editForm, rut_dni: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        </td>
                        {/* Editar Nombre */}
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white"
                          />
                        </td>
                        {/* Editar Club */}
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.club_name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, club_name: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white"
                          />
                        </td>
                        {/* Editar Año */}
                        <td className="px-4 py-2 w-24">
                          <input
                            type="number"
                            min={1940}
                            max={currentYear}
                            value={editForm.birth_year}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                birth_year: parseInt(e.target.value, 10) || currentYear,
                              })
                            }
                            className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        </td>
                        {/* Editar Género */}
                        <td className="px-4 py-2">
                          <select
                            value={editForm.gender}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                gender: e.target.value as 'M' | 'F',
                              })
                            }
                            className="bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        </td>
                        {/* Editar Categoría (Dropdown Dinámico) */}
                        <td className="px-4 py-2">
                          <select
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white"
                          >
                            {/* Incluir categoría actual si no está en la lista estándar */}
                            {!editAvailable.categories.includes(editForm.category) && (
                              <option value={editForm.category}>
                                {editForm.category}
                              </option>
                            )}
                            {editAvailable.categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Acciones de Edición */}
                        <td className="px-4 py-2 text-right space-x-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                            title="Guardar cambios"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // FILA EN MODO LECTURA NORMAL
                  const age = currentYear - athlete.birth_year;

                  return (
                    <tr key={athlete.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">
                        {athlete.rut_dni}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{athlete.name}</td>
                      <td className="px-4 py-3 text-slate-300">{athlete.club_name}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {athlete.birth_year} ({age}a)
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            athlete.gender === 'M'
                              ? 'bg-blue-950 text-blue-400'
                              : 'bg-pink-950 text-pink-400'
                          }`}
                        >
                          {athlete.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {athlete.category}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(athlete)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Editar atleta"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(athlete.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 transition"
                          title="Eliminar de borrador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 3. RESUMEN DE LLAVES DERIVADAS DEL BORRADOR */}
      {/* ==================================================================== */}
      {categorySummaries.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
            <span>Diagnóstico de Llaves en Borrador (Reglas IJF)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categorySummaries.map((cat) => (
              <div
                key={cat.name}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-white block truncate">
                    {cat.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {cat.count} {cat.count === 1 ? 'atleta' : 'atletas'}
                  </span>
                </div>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                    cat.bracketType === 'BEST_OF_3'
                      ? 'bg-purple-950 text-purple-400 border border-purple-800'
                      : cat.bracketType === 'ROUND_ROBIN'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : cat.bracketType === 'SINGLE_ELIMINATION'
                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                      : 'bg-red-950 text-red-400 border border-red-800'
                  }`}
                >
                  {cat.bracketTypeLabel}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
