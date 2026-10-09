// ==============================================================================
// COMPONENTE: MÓDULO ETL DE IMPORTACIÓN DE NÓMINAS (ROSTER UPLOAD)
// ==============================================================================
//
// ¿POR QUÉ PARSEAR EN EL CLIENTE Y ENVIAR JSON AL BACKEND?
// 1. Arquitectura Serverless y Costos: Subir archivos multipart crudos al backend
//    consume memoria RAM de las funciones serverless de Next.js/Vercel (límite de 4.5MB
//    a 10MB en payloads multipart) y satura el hilo de Node.js parseando buffers.
// 2. Feedback Inmediato al Operador: La validación ocurre a 0ms en la CPU del navegador.
//    Si una fila tiene un RUT duplicado o formato inválido, el operador lo ve antes
//    de emitir una sola petición HTTP.
// 3. Sanitización Cero Confianza: El cliente limpia espacios, normaliza campos
//    (ej. 'Masculino' -> 'M') y emite un JSON estructurado y tipado.
//
// ==============================================================================

'use client';

import React, { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  Competitor,
  generateCategoryBracket,
  BracketResult,
} from '@/lib/rules/bracket-engine';

export interface ParsedAthlete {
  id: string;
  name: string;
  last_name?: string;
  rut_dni: string;
  club_name: string;
  category: string;
  gender: 'M' | 'F';
  birth_date?: string;
  weight?: number;
  seed?: number;
  isValid: boolean;
  errors: string[];
}

interface CategoryGroup {
  name: string;
  athletes: ParsedAthlete[];
  bracketType: 'BEST_OF_3' | 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'INSUFFICIENT';
  bracketTypeLabel: string;
}

interface RosterUploadProps {
  organizationId?: string;
  tournamentId?: string;
  onImportComplete?: (athletes: ParsedAthlete[], brackets: BracketResult[]) => void;
}

export function RosterUpload({
  organizationId = 'a0000000-0000-0000-0000-000000000001',
  tournamentId = 'e0000000-0000-0000-0000-000000000001',
  onImportComplete,
}: RosterUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedAthletes, setParsedAthletes] = useState<ParsedAthlete[]>([]);
  const [generatedBrackets, setGeneratedBrackets] = useState<BracketResult[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalizador de nombres de columnas comunes
  const normalizeKey = (key: string): string => {
    const clean = key
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (clean.includes('rut') || clean.includes('dni') || clean.includes('doc')) return 'rut_dni';
    if (clean.includes('nombre') && !clean.includes('apellido')) return 'name';
    if (clean.includes('apellido')) return 'last_name';
    if (clean.includes('club') || clean.includes('equipo') || clean.includes('academia')) return 'club_name';
    if (clean.includes('cat') || clean.includes('division')) return 'category';
    if (clean.includes('gen') || clean.includes('sex')) return 'gender';
    if (clean.includes('peso') || clean.includes('weight')) return 'weight';
    if (clean.includes('seed') || clean.includes('siembra') || clean.includes('ranking')) return 'seed';
    if (clean.includes('nacimiento') || clean.includes('birth')) return 'birth_date';
    return clean;
  };

  // Procesamiento del archivo con PapaParse en el navegador
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setStatusMessage(null);

    Papa.parse<Record<string, any>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeKey(header),
      complete: (results) => {
        const seenRuts = new Set<string>();
        const athletes: ParsedAthlete[] = [];

        results.data.forEach((row, index) => {
          const errors: string[] = [];

          // 1. Nombre
          const rawName = (row.name || '').trim();
          const rawLastName = (row.last_name || '').trim();
          const fullName = rawLastName ? `${rawName} ${rawLastName}` : rawName;
          if (!fullName) {
            errors.push('Falta el nombre del atleta');
          }

          // 2. RUT / DNI
          const rut = (row.rut_dni || '').toString().trim().toUpperCase().replace(/[.\-\s]/g, '');
          if (!rut) {
            errors.push('Falta el RUT o DNI');
          } else if (seenRuts.has(rut)) {
            errors.push(`RUT duplicado en la nómina (${rut})`);
          } else {
            seenRuts.add(rut);
          }

          // 3. Género
          const rawGender = (row.gender || '').toString().trim().toUpperCase();
          let gender: 'M' | 'F' = 'M';
          if (rawGender.startsWith('F') || rawGender.includes('FEM') || rawGender.includes('MUJ')) {
            gender = 'F';
          } else if (rawGender.startsWith('M') || rawGender.includes('VAR') || rawGender.includes('HOM')) {
            gender = 'M';
          } else {
            errors.push('Género no reconocido (debe ser M o F)');
          }

          // 4. Categoría
          const category = (row.category || 'Categoría Abierta').toString().trim();
          if (!category) {
            errors.push('Categoría no asignada');
          }

          // 5. Club
          const club = (row.club_name || 'Independiente').toString().trim();

          // 6. Peso y Seed opcionales
          const weight = row.weight ? parseFloat(row.weight) : undefined;
          const seed = row.seed ? parseInt(row.seed, 10) : undefined;

          // Generar ID único
          const id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `athlete-${index + 1}`;

          athletes.push({
            id,
            name: fullName,
            last_name: rawLastName,
            rut_dni: rut,
            club_name: club,
            category,
            gender,
            birth_date: row.birth_date ? String(row.birth_date).trim() : undefined,
            weight: isNaN(weight as number) ? undefined : weight,
            seed: isNaN(seed as number) ? undefined : seed,
            isValid: errors.length === 0,
            errors,
          });
        });

        setParsedAthletes(athletes);
        setIsProcessing(false);
      },
      error: (err) => {
        setIsProcessing(false);
        setStatusMessage(`Error leyendo el archivo: ${err.message}`);
      },
    });
  };

  // Agrupación por categoría e inferencia de modalidad de sorteo
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groups: { [cat: string]: ParsedAthlete[] } = {};

    parsedAthletes.forEach((a) => {
      if (!groups[a.category]) {
        groups[a.category] = [];
      }
      groups[a.category].push(a);
    });

    return Object.entries(groups).map(([name, athletes]) => {
      const count = athletes.length;
      let bracketType: CategoryGroup['bracketType'] = 'SINGLE_ELIMINATION';
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

      return {
        name,
        athletes,
        bracketType,
        bracketTypeLabel,
      };
    });
  }, [parsedAthletes]);

  // Ejecutar el motor de sorteo para todas las categorías válidas
  const handleGenerateAllBrackets = () => {
    const brackets: BracketResult[] = [];
    let startMatchNumber = 1;

    categoryGroups.forEach((group, groupIdx) => {
      if (group.athletes.length < 2) return;

      const competitors: Competitor[] = group.athletes.map((a) => ({
        id: a.id,
        name: a.name,
        club_name: a.club_name,
        seed: a.seed,
        weight: a.weight,
      }));

      // Asignar tatami (distribuir entre tatami 1 y 2 según índice de categoría)
      const tatamiNumber = (groupIdx % 2) + 1;

      const result = generateCategoryBracket(competitors, {
        organization_id: organizationId,
        tournament_id: tournamentId,
        category_id: `cat-${groupIdx + 1}`,
        category_name: group.name,
        tatami_number: tatamiNumber,
        start_match_number: startMatchNumber,
      });

      startMatchNumber += result.total_matches;
      brackets.push(result);
    });

    setGeneratedBrackets(brackets);
    setStatusMessage(
      `¡Sorteo completado con éxito! Se generaron ${brackets.reduce(
        (acc, b) => acc + b.total_matches,
        0
      )} combates en ${brackets.length} categorías.`
    );

    if (onImportComplete) {
      onImportComplete(parsedAthletes, brackets);
    }
  };

  // Descargar JSON sanitizado
  const handleDownloadJSON = () => {
    const payload = {
      tournament_id: tournamentId,
      organization_id: organizationId,
      total_athletes: parsedAthletes.length,
      categories_count: categoryGroups.length,
      athletes: parsedAthletes,
      brackets: generatedBrackets,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nomina_sorteo_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Métricas rápidas
  const validCount = parsedAthletes.filter((a) => a.isValid).length;
  const errorCount = parsedAthletes.length - validCount;

  // Filtrado de la tabla de atletas
  const filteredAthletes = useMemo(() => {
    if (filterCategory === 'ALL') return parsedAthletes;
    return parsedAthletes.filter((a) => a.category === filterCategory);
  }, [parsedAthletes, filterCategory]);

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans">
      {/* ==================================================================== */}
      {/* ZONA DE CARGA DEL ARCHIVO (DRAG & DROP) */}
      {/* ==================================================================== */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-amber-500 bg-slate-900/60 hover:bg-slate-900/90 transition-all rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center space-y-3"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl font-bold">
          📄
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-200">
            {file ? file.name : 'Haz clic o arrastra aquí tu nómina de atletas (.CSV)'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Soporta columnas: Nombre, Apellido, RUT/DNI, Club, Categoría, Género (M/F), Peso, Seed.
          </p>
        </div>

        {isProcessing && (
          <div className="text-xs text-amber-400 animate-pulse font-mono font-bold">
            ⚡ Procesando y validando en el navegador...
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MÉTRICAS DEL ETL */}
      {/* ==================================================================== */}
      {parsedAthletes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Total Atletas
            </span>
            <div className="text-3xl font-black text-white mt-1">
              {parsedAthletes.length}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Registros Válidos
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              {validCount}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Observaciones / Errores
            </span>
            <div className={`text-3xl font-black mt-1 ${errorCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {errorCount}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Categorías
            </span>
            <div className="text-3xl font-black text-amber-400 mt-1">
              {categoryGroups.length}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* RESUMEN POR CATEGORÍAS Y MOTOR DE SORTEO DINÁMICO */}
      {/* ==================================================================== */}
      {categoryGroups.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-lg font-bold text-white">
                Distribución de Categorías y Modalidad Asignada
              </h4>
              <p className="text-xs text-slate-400">
                El sistema detecta automáticamente la regla IJF correspondiente a cada categoría.
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleGenerateAllBrackets}
                disabled={errorCount > 0}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                  errorCount > 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                }`}
              >
                ⚡ Sortear Todas las Llaves
              </button>

              <button
                onClick={handleDownloadJSON}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition"
              >
                📥 Descargar JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {categoryGroups.map((group) => (
              <div
                key={group.name}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between"
              >
                <div>
                  <span className="text-sm font-bold text-slate-200 block truncate">
                    {group.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {group.athletes.length} competidores inscritos
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      group.bracketType === 'BEST_OF_3'
                        ? 'bg-purple-950 text-purple-400 border border-purple-700'
                        : group.bracketType === 'ROUND_ROBIN'
                        ? 'bg-amber-950 text-amber-400 border border-amber-700'
                        : group.bracketType === 'SINGLE_ELIMINATION'
                        ? 'bg-blue-950 text-blue-400 border border-blue-700'
                        : 'bg-red-950 text-red-400 border border-red-700'
                    }`}
                  >
                    {group.bracketTypeLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MENSAJE DE ESTADO */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 text-sm font-medium">
          {statusMessage}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TABLA DE PREVISUALIZACIÓN DE ATLETAS */}
      {/* ==================================================================== */}
      {parsedAthletes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-200">
              Previsualización de Nómina Sanitizada ({filteredAthletes.length} atletas)
            </span>

            {/* Filtro por categoría */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">Todas las Categorías</option>
              {categoryGroups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.athletes.length})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">RUT / DNI</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Género</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAthletes.map((athlete, idx) => (
                  <tr
                    key={athlete.id}
                    className={`hover:bg-slate-800/40 transition ${
                      !athlete.isValid ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-200">{athlete.name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{athlete.rut_dni}</td>
                    <td className="px-4 py-2.5 text-slate-300">{athlete.club_name}</td>
                    <td className="px-4 py-2.5 text-amber-400 font-medium">{athlete.category}</td>
                    <td className="px-4 py-2.5">
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
                    <td className="px-4 py-2.5">
                      {athlete.isValid ? (
                        <span className="text-emerald-400 font-bold">✓ Válido</span>
                      ) : (
                        <span
                          className="text-red-400 font-bold"
                          title={athlete.errors.join(' | ')}
                        >
                          ✕ {athlete.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
