import React from 'react';
import { RosterUpload } from '@/components/admin/roster-upload';

export default function RosterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-black text-amber-400">JUDO RANKING</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Fase 5 • Módulo ETL
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-2">
            Importación de Nóminas y Motor de Sorteo
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Carga el archivo CSV con los atletas inscritos. El sistema validará los datos en tu navegador
            y generará automáticamente las llaves bajo el reglamento IJF (Mejor de 3, Round Robin Berger o Eliminación Simple).
          </p>
        </header>

        <main>
          <RosterUpload />
        </main>
      </div>
    </div>
  );
}
