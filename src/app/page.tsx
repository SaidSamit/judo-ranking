import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-950 via-slate-900 to-black">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-3">
          <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-blue-400 uppercase bg-blue-950/60 border border-blue-800 rounded-full">
            Plataforma B2B • Judo Reglas IJF
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
            Mesa de Control & Ranking
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Arquitectura Serverless Offline-First para torneos federados, cronometría inteligente de Osaekomi y degradación temporal de puntos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <Link
            href="/tatami/match-1"
            className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl text-left space-y-3 shadow-lg hover:border-blue-600 transition block group"
          >
            <div className="h-10 w-10 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition">
              🥋
            </div>
            <h2 className="text-xl font-bold text-white flex items-center justify-between">
              Mesa de Tatami 1
              <span className="text-xs text-blue-400 font-normal">Abrir Consola →</span>
            </h2>
            <p className="text-sm text-slate-400">
              Operación con atajos de teclado, pila de Event Sourcing inmutable y tolerancia a cortes de internet vía IndexedDB.
            </p>
            <div className="pt-2">
              <span className="text-xs text-blue-400 font-mono bg-blue-950/40 px-2 py-1 rounded">
                Hotkeys: Q, W, E, R, A vs U, I, O, P, L
              </span>
            </div>
          </Link>

          <Link
            href="/scoreboard/tatami-1"
            className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl text-left space-y-3 shadow-lg hover:border-yellow-600 transition block group"
          >
            <div className="h-10 w-10 bg-yellow-600/20 text-yellow-400 rounded-lg flex items-center justify-center font-bold text-lg group-hover:bg-yellow-600 group-hover:text-slate-950 transition">
              📺
            </div>
            <h2 className="text-xl font-bold text-white flex items-center justify-between">
              Marcador Público (TV)
              <span className="text-xs text-yellow-400 font-normal">Abrir TV →</span>
            </h2>
            <p className="text-sm text-slate-400">
              Sincronización en milisegundos mediante Supabase Realtime Channels. Modo corrección silenciosa en Mate.
            </p>
            <div className="pt-2">
              <span className="text-xs text-yellow-400 font-mono bg-yellow-950/40 px-2 py-1 rounded">
                Canal: tatami-1 • Latencia &lt; 20ms
              </span>
            </div>
          </Link>

          <Link
            href="/admin/roster"
            className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl text-left space-y-3 shadow-lg hover:border-emerald-600 transition block group"
          >
            <div className="h-10 w-10 bg-emerald-600/20 text-emerald-400 rounded-lg flex items-center justify-center font-bold text-lg group-hover:bg-emerald-600 group-hover:text-white transition">
              📑
            </div>
            <h2 className="text-xl font-bold text-white flex items-center justify-between">
              Módulo ETL & Sorteo
              <span className="text-xs text-emerald-400 font-normal">Importar Nómina →</span>
            </h2>
            <p className="text-sm text-slate-400">
              Importación CSV en cliente con PapaParse, validación de RUT y generación dinámica de llaves (Best of 3, Round Robin Berger o Eliminación Simple).
            </p>
            <div className="pt-2">
              <span className="text-xs text-emerald-400 font-mono bg-emerald-950/40 px-2 py-1 rounded">
                Reglas IJF • Algoritmo Híbrido
              </span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
