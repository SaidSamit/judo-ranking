// ==============================================================================
// PESTAÑA: CREDENCIALES PIN Y FICHAS DE ESTACIONES DE CONTROL
// ==============================================================================
//
// 1. Exportación oficial a PDF con resumen de control por tatami.
// 2. Ocultamiento completo de elementos administrativos al imprimir (print:hidden).
// 3. Fichas de mesa de control con PIN, URL y métricas (categorías y judokas asignados).
// 4. Fichas de báscula de pesaje con PIN y filtro reglamentario.
//
// ==============================================================================

'use client';

import React, { useState } from 'react';
import { KeyRound, Check, Copy, Printer, Monitor, Scale, FileText, FileDown, Loader2 } from 'lucide-react';
import { TatamiCredential } from '@/app/actions/tournament-builder';
import { downloadElementAsPdf } from '@/lib/utils/pdf-downloader';

export interface TatamiSummaryItem {
  categoriesCount: number;
  athletesCount: number;
  categoryNames: string[];
}

interface TournamentCredentialsTabProps {
  tournamentName: string;
  credentials: TatamiCredential[];
  tatamiSummary?: Record<number, TatamiSummaryItem>;
  copiedSlug: string | null;
  onCopyPin: (slug: string, pin: string) => void;
  onPrint: () => void;
}

export function TournamentCredentialsTab({
  tournamentName,
  credentials,
  tatamiSummary,
  copiedSlug,
  onCopyPin,
  onPrint,
}: TournamentCredentialsTabProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const tatamiCredentials = credentials.filter(
    (c) => c.type === 'TATAMI_TABLE' || (c.tatami_number !== null && c.tatami_number !== undefined)
  );

  const weighInCredentials = credentials.filter(
    (c) => c.type === 'WEIGH_IN' || c.station_slug?.startsWith('pesaje')
  );

  const handleDownloadCredentialsPdf = async () => {
    const el = document.getElementById('printable-credentials-container');
    if (!el) return;
    setIsExportingPdf(true);
    try {
      el.classList.remove('hidden');
      el.classList.add('block');
      await downloadElementAsPdf(el, {
        filename: `Credenciales_Estaciones_${tournamentName.replace(/\s+/g, '_')}`,
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('Error generando PDF de credenciales:', err);
    } finally {
      el.classList.remove('block');
      el.classList.add('hidden');
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* VISTA EN PANTALLA (INTERACTIVA - OCULTA AL IMPRIMIR)                */}
      {/* ==================================================================== */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Credenciales PIN de Estaciones - {tournamentName}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              PINs criptográficos generados para mesas de arbitraje y estaciones oficiales de pesaje.
              Descarga estas fichas oficiales en PDF con los controles rápidos de cada mesa para los oficiales.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadCredentialsPdf}
              disabled={isExportingPdf}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 shadow-lg disabled:opacity-60 cursor-pointer"
              title="Descargar archivo PDF con las credenciales oficiales y controles de mesa"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Exportar a PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SECCIÓN 1: MESAS DE TATAMI */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-200">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span>Mesas de Control de Tatami ({tatamiCredentials.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tatamiCredentials.map((cred) => {
              const summary = cred.tatami_number ? tatamiSummary?.[cred.tatami_number] : null;

              return (
                <div
                  key={cred.station_slug}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                        <span>Tatami {cred.tatami_number}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Mesa Habilitada
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-white">{cred.station_name}</h4>
                      <span className="text-xs font-mono text-slate-400">
                        Slug de Acceso: <strong className="text-amber-300">{cred.station_slug}</strong>
                      </span>
                    </div>

                    {/* RESUMEN DEL CONTROL DE TATAMI */}
                    {summary && (
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Categorías asignadas:</span>
                          <span className="font-mono font-bold text-amber-400">{summary.categoriesCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Judokas programados:</span>
                          <span className="font-mono font-bold text-blue-400">{summary.athletesCount}</span>
                        </div>
                      </div>
                    )}

                    {/* CAJA DEL PIN */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          PIN de Acceso
                        </span>
                        <span className="text-2xl font-black font-mono tracking-widest text-amber-400">
                          {cred.pin}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onCopyPin(cred.station_slug, cred.pin)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Copiar PIN"
                      >
                        {copiedSlug === cred.station_slug ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono truncate pt-1 border-t border-slate-900">
                    Mesa #{cred.tatami_number} • Estación Oficial
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 2: ESTACIONES DE PESAJE */}
        {weighInCredentials.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-200">
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>Estaciones de Pesaje Oficial ({weighInCredentials.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {weighInCredentials.map((cred) => {
                const genderFilter = cred.metadata?.gender_filter;
                const isMaleOnly = genderFilter === 'M';
                const isFemaleOnly = genderFilter === 'F';

                return (
                  <div
                    key={cred.station_slug}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                          <Scale className="w-3.5 h-3.5" />
                          <span>Báscula Oficial</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            isMaleOnly
                              ? 'bg-blue-950 text-blue-400 border-blue-800'
                              : isFemaleOnly
                              ? 'bg-pink-950 text-pink-400 border-pink-800'
                              : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          }`}
                        >
                          {isMaleOnly
                            ? 'Solo Varones (M)'
                            : isFemaleOnly
                            ? 'Solo Damas (F)'
                            : 'General (Ambos)'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white">{cred.station_name}</h4>
                        <span className="text-xs font-mono text-slate-400">
                          Slug de Acceso: <strong className="text-emerald-400">{cred.station_slug}</strong>
                        </span>
                      </div>

                      {/* CAJA DEL PIN */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            PIN de Acceso
                          </span>
                          <span className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                            {cred.pin}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onCopyPin(cred.station_slug, cred.pin)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Copiar PIN"
                        >
                          {copiedSlug === cred.station_slug ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono truncate pt-1 border-t border-slate-900">
                      Báscula Independiente • Estación Oficial
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* VISTA OFICIAL DE EXPORTACIÓN A PDF (CAPTURA DIRECTA CON HTML2CANVAS)  */}
      {/* ==================================================================== */}
      <div id="printable-credentials-container" className="hidden text-slate-950 bg-white p-6 space-y-6 max-w-4xl mx-auto">
        {/* CABECERA OFICIAL DEL DOCUMENTO */}
        <div className="border-b-2 border-slate-950 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">{tournamentName}</h1>
            <h2 className="text-sm font-bold text-slate-700">
              Fichas Oficiales de Mesas de Control y Credenciales de Acceso
            </h2>
          </div>
          <div className="text-right text-xs font-mono text-slate-600">
            <p>Fecha de emisión: {new Date().toLocaleDateString('es-CL')}</p>
            <p>{tatamiCredentials.length} Mesas de Tatami • {weighInCredentials.length} Básculas de Pesaje</p>
          </div>
        </div>

        {/* 1. FICHAS DE MESAS DE CONTROL CON CONTROLES DE MESA */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-300 pb-1 text-slate-800">
            Mesas de Control de Tatami
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {tatamiCredentials.map((cred) => {
              return (
                <div
                  key={cred.station_slug}
                  className="border-2 border-slate-800 rounded-xl p-4 space-y-3 break-inside-avoid shadow-sm bg-white"
                >
                  <div className="flex justify-between items-center border-b border-slate-300 pb-1.5">
                    <span className="text-sm font-black uppercase text-slate-950">
                      Mesa de Control - Tatami #{cred.tatami_number}
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-slate-200 px-2 py-0.5 rounded border border-slate-400">
                      Habilitada
                    </span>
                  </div>

                  {/* CUADRO DESTACADO DEL PIN */}
                  <div className="bg-slate-50 border-2 border-slate-400 rounded-lg p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      PIN DE ACCESO OFICIAL
                    </span>
                    <span className="text-3xl font-black font-mono tracking-widest text-slate-950">
                      {cred.pin}
                    </span>
                  </div>

                  {/* CONTROLES DE MESA Y ATAJOS RÁPIDOS (EN LUGAR DE RESUMEN DE CATEGORÍAS) */}
                  <div className="border-t border-slate-300 pt-2 text-xs space-y-1.5">
                    <span className="font-black text-slate-900 block text-[11px] uppercase tracking-wider">
                      Controles de Mesa y Atajos Rápidos:
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] text-slate-800">
                      <div><strong className="text-slate-950">[Espacio]:</strong> Hajime / Mate</div>
                      <div><strong className="text-slate-950">[Enter]:</strong> Finalizar Combate</div>
                      <div><strong className="text-blue-700">[← / A]:</strong> Osaekomi Blanco</div>
                      <div><strong className="text-blue-900">[→ / L]:</strong> Osaekomi Azul</div>
                      <div><strong className="text-slate-950">[↓ / S]:</strong> Toketa (Detener)</div>
                      <div><strong className="text-slate-950">[X]:</strong> Swap Osaekomi</div>
                      <div><strong className="text-slate-950">[Q / U]:</strong> Ippon (B / A)</div>
                      <div><strong className="text-slate-950">[W / I]:</strong> Waza-ari (B / A)</div>
                      <div><strong className="text-slate-950">[E / O]:</strong> Yuko (B / A)</div>
                      <div><strong className="text-slate-950">[R / P]:</strong> Shido (B / A)</div>
                      <div className="col-span-2 text-slate-600 border-t border-slate-200 pt-0.5">
                        <strong className="text-slate-950">[Shift + Tecla]:</strong> Deshacer acción (Undo)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. FICHAS DE ESTACIONES DE PESAJE */}
        {weighInCredentials.length > 0 && (
          <div className="space-y-3 pt-3">
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-300 pb-1 text-slate-800">
              Estaciones Oficiales de Pesaje
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {weighInCredentials.map((cred) => {
                const genderFilter = cred.metadata?.gender_filter;
                const filterText =
                  genderFilter === 'M'
                    ? 'Solo Varones (M)'
                    : genderFilter === 'F'
                    ? 'Solo Damas (F)'
                    : 'General (Ambos géneros)';

                return (
                  <div
                    key={cred.station_slug}
                    className="border-2 border-slate-800 rounded-xl p-4 space-y-3 break-inside-avoid shadow-sm bg-white"
                  >
                    <div className="flex justify-between items-center border-b border-slate-300 pb-1.5">
                      <span className="text-sm font-black uppercase text-slate-950">
                        {cred.station_name}
                      </span>
                      <span className="text-[10px] font-bold uppercase bg-slate-200 px-2 py-0.5 rounded border border-slate-400">
                        Báscula Oficial
                      </span>
                    </div>

                    {/* CUADRO DESTACADO DEL PIN */}
                    <div className="bg-slate-50 border-2 border-slate-400 rounded-lg p-2.5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        PIN DE ACCESO OFICIAL
                      </span>
                      <span className="text-3xl font-black font-mono tracking-widest text-slate-950">
                        {cred.pin}
                      </span>
                    </div>

                    {/* OPERACIÓN DE BÁSCULA */}
                    <div className="border-t border-slate-300 pt-2 text-xs space-y-1">
                      <span className="font-black text-slate-900 block text-[11px] uppercase tracking-wider">
                        Operación de Báscula:
                      </span>
                      <p className="text-[10px] font-mono text-slate-800">
                        <strong>Filtro Reglamentario:</strong> {filterText}
                      </p>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-800 pt-0.5">
                        <div><strong className="text-slate-950">[Enter]:</strong> Confirmar Peso</div>
                        <div><strong className="text-slate-950">[Tab / ↑↓]:</strong> Navegar Atleta</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
