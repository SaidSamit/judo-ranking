// ==============================================================================
// COMPONENTE: BARRA LATERAL PROFESIONAL (ENTERPRISE SIDEBAR)
// ==============================================================================
//
// CARACTERÍSTICAS DE DISEÑO:
// - Estilo Enterprise / SaaS moderno (Linear, Vercel, Smoothcomp).
// - Modo expandible y colapsable con persistencia local.
// - Menú lateral enfocado y limpio: Ningún módulo específico (pesaje, nómina,
//   llaves, tatamis) aparece de forma global desacoplada.
// - Todo el flujo de un torneo ocurre estrictamente dentro del campeonato
//   seleccionado (/admin/tournaments/[id]).
// - Soporte responsive con menú hamburguesa para tablets y dispositivos móviles.
//
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
  LogOut,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  isExternal?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Recuperar preferencia de colapso si existe
    const saved = localStorage.getItem('judo_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('judo_sidebar_collapsed', String(next));
  };

  const isInsideTournament =
    pathname.startsWith('/admin/tournaments/') && pathname !== '/admin/tournaments';

  // Secciones de navegación del sidebar (Limpio y aislado por campeonato)
  const navSections: NavSection[] = [
    {
      title: 'Competición Oficial',
      items: [
        {
          label: 'Campeonatos',
          href: '/admin/tournaments',
          icon: Trophy,
          badge: 'Principal',
          badgeColor: 'bg-amber-950/80 text-amber-400 border-amber-800',
        },
      ],
    },
  ];

  if (!mounted) return null;

  return (
    <>
      {/* BOTÓN MÓVIL (HAMBURGUESA) */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white shadow-xl focus:outline-none"
          aria-label="Abrir menú"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* OVERLAY PARA DISPOSITIVOS MÓVILES */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        />
      )}

      {/* SIDEBAR PRINCIPAL */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col bg-slate-950 border-r border-slate-800/80 transition-all duration-300 ease-in-out select-none shadow-2xl ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* CABECERA DEL SIDEBAR / BRANDING */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center space-x-3 truncate">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 flex-shrink-0">
                🥋
              </div>
              <div className="truncate">
                <span className="text-sm font-black text-white tracking-wider block truncate">
                  JUDO RANKING
                </span>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block truncate">
                  Mesa de Dirección
                </span>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 flex-shrink-0">
              🥋
            </div>
          )}

          {/* BOTÓN COLAPSAR (SOLO DESKTOP) */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* INDICADOR DE ESTADO EN VIVO */}
        {!isCollapsed && (
          <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400">Torneo Activo</span>
            </div>
            <span className="text-emerald-400 font-bold">Realtime 0ms</span>
          </div>
        )}

        {/* NAVEGACIÓN PRINCIPAL */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
                  {section.title}
                </span>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={item.isExternal ? '_blank' : undefined}
                      onClick={() => setIsMobileOpen(false)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10 font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 transition ${
                            isActive
                              ? 'text-slate-950'
                              : 'text-slate-400 group-hover:text-amber-400'
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold uppercase ${
                                isActive
                                  ? 'bg-slate-950/20 text-slate-950 border-slate-950/40'
                                  : item.badgeColor ||
                                    'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.isExternal && (
                            <ExternalLink
                              className={`w-3 h-3 ${
                                isActive ? 'text-slate-950' : 'text-slate-400'
                              }`}
                            />
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* INDICADOR CONTEXTUAL: SI EL USUARIO ESTÁ GESTIONANDO UN CAMPEONATO */}
          {isInsideTournament && !isCollapsed && (
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2 mt-4">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-black">
                <Trophy className="w-3.5 h-3.5" />
                <span>Modo Campeonato</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nómina, pesaje, llaves de sorteo y tatamis están concentrados en las pestañas de este campeonato.
              </p>
              <div className="pt-1">
                <Link
                  href="/admin/tournaments"
                  className="inline-flex items-center space-x-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Campeonatos</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* PIE DEL SIDEBAR / PERFIL DE LA ESTACIÓN */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  DT
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-white block truncate">
                    Director de Torneo
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Asoc. Judo Tarapacá
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <Shield className="w-4 h-4 text-emerald-400" />
                <Link
                  href="/"
                  title="Cerrar Sesión / Salir"
                  className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href="/"
              title="Cerrar Sesión / Salir"
              className="w-8 h-8 mx-auto rounded-lg bg-blue-600 hover:bg-red-600 flex items-center justify-center text-xs font-bold text-white transition block text-center leading-8"
            >
              DT
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
