import React from 'react';
import Link from 'next/link';
import { RosterUpload } from '@/components/admin/roster-upload';

export default function RosterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* NAVEGACIÓN SUPERIOR DE ADMINISTRACIÓN */}
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-black text-amber-400">JUDO RANKING</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Fase 5 • Acreditación & Nómina
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-bold">
            <Link
              href="/admin/roster"
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black shadow"
            >
              Nómina / ETL
            </Link>
            <Link
              href="/admin/weigh-in"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            >
              Estación de Pesaje
            </Link>
            <Link
              href="/admin/brackets"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            >
              Panel del Director (Llaves)
            </Link>
            <Link
              href="/admin/tatami/1"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            >
              Cola Tatami 1
            </Link>
          </div>
        </nav>

        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-white">
            Acreditación de Atletas y Gestión de Nómina
          </h1>
          <p className="text-slate-400 text-sm">
            Ingresa atletas manualmente con el formulario ágil o importa un CSV complementario.
            Revisa, edita o elimina registros en la tabla temporal antes de confirmar masivamente en la base de datos.
          </p>
        </header>

        <main>
          <RosterUpload />
        </main>
      </div>
    </div>
  );
}
