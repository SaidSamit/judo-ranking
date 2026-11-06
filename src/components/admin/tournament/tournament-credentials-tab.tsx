'use client';

import React from 'react';
import { KeyRound, Check, Copy, Printer } from 'lucide-react';
import { TatamiCredential } from '@/app/actions/tournament-builder';

interface TournamentCredentialsTabProps {
  tournamentName: string;
  credentials: TatamiCredential[];
  copiedSlug: string | null;
  copiedAll: boolean;
  onCopyPin: (slug: string, pin: string) => void;
  onCopyAll: () => void;
  onPrint: () => void;
}

export function TournamentCredentialsTab({
  tournamentName,
  credentials,
  copiedSlug,
  copiedAll,
  onCopyPin,
  onCopyAll,
  onPrint,
}: TournamentCredentialsTabProps) {
  return (
    <div className="space-y-6">
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Credenciales PIN de Tatamis - {tournamentName}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              PINs criptográficos generados para cada mesa de control. Imprime estas fichas o
              cópialas para entregarlas a los oficiales de mesa el día del campeonato.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onCopyAll}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1.5"
            >
              {copiedAll ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedAll ? '¡Copiado!' : 'Copiar Todas'}</span>
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 shadow-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Fichas de Mesa</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE CREDENCIALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {credentials.map((cred) => (
            <div
              key={cred.station_slug}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Tatami {cred.tatami_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Mesa Habilitada
                </span>
              </div>

              <div>
                <h4 className="text-base font-black text-white">{cred.station_name}</h4>
                <span className="text-xs font-mono text-slate-400">
                  Slug: {cred.station_slug}
                </span>
              </div>

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

              <div className="text-[11px] text-slate-500 font-mono truncate">
                Mesa #{cred.tatami_number} • Estación Oficial
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
