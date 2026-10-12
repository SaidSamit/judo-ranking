// ==============================================================================
// COMPONENTE: CABECERA SUPERIOR ENTERPRISE (ADMIN TOP HEADER)
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  Radio,
  Tv,
  Calendar,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { logoutAdminAction } from '@/app/actions/auth';

export function AdminTopHeader() {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generar migas de pan según la ruta
  const getBreadcrumbs = () => {
    if (pathname.startsWith('/admin/tournaments/') && pathname !== '/admin/tournaments') {
      return { section: 'Campeonatos', page: 'Gestión del Torneo' };
    }
    if (pathname.includes('/admin/tournaments')) {
      return { section: 'Competición', page: 'Gestión de Campeonatos' };
    }
    if (pathname.includes('/admin/tatami')) {
      const tatamiNum = pathname.split('/').pop() || '1';
      return { section: 'Mesa de Control', page: `Cola de Tatami #${tatamiNum}` };
    }
    return { section: 'Administración', page: 'Panel Central' };
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-30 sticky top-0 font-sans">
      {/* MIGAS DE PAN (BREADCRUMBS) */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-400 font-medium">{breadcrumbs.section}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-white font-bold">{breadcrumbs.page}</span>
      </div>

      {/* INFORMACIÓN EN VIVO Y ACCESOS RÁPIDOS */}
      <div className="flex items-center space-x-4 text-xs font-mono">
        {/* RELOJ EN VIVO */}
        {timeStr && (
          <div className="hidden sm:flex items-center space-x-1.5 text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">{timeStr}</span>
          </div>
        )}

        {/* CERRAR SESIÓN */}
        <button
          onClick={() => logoutAdminAction()}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/50 transition font-sans font-bold text-xs cursor-pointer"
          title="Cerrar sesión de Director"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
