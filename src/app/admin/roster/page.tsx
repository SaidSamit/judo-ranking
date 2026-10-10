import React from 'react';
import { RosterUpload } from '@/components/admin/roster-upload';

export default function RosterPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <header className="space-y-1 border-b border-slate-800/80 pb-5">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
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
  );
}
