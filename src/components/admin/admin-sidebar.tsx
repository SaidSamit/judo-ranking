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
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
  LogOut,
  ExternalLink,
  Layers,
  Users,
  Scale,
  KeyRound,
  Swords,
  Settings,
  Camera,
  Trash2,
  User,
  Check,
} from 'lucide-react';

export interface AdminSidebarUserProfile {
  email?: string;
  role?: string;
  name?: string;
  organization?: string;
  initials?: string;
}

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

interface AdminSidebarProps {
  userProfile?: AdminSidebarUserProfile;
}

export function AdminSidebar({ userProfile }: AdminSidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Estados de avatar y personalización de perfil
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>(userProfile?.name || 'Director de Torneo');
  const [profileOrg, setProfileOrg] = useState<string>(userProfile?.organization || '');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // Recuperar preferencia de colapso si existe
    const saved = localStorage.getItem('judo_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }

    // Cargar avatar y personalización desde localStorage
    try {
      const savedAvatar = localStorage.getItem('judo_admin_avatar');
      if (savedAvatar) setAvatarUrl(savedAvatar);
      const savedName = localStorage.getItem('judo_admin_name');
      if (savedName) setProfileName(savedName);
      const savedOrg = localStorage.getItem('judo_admin_org');
      // Si existía el valor estático antiguo "Asoc. Judo Tarapacá", purgarlo inmediatamente
      if (savedOrg === 'Asoc. Judo Tarapacá') {
        localStorage.removeItem('judo_admin_org');
      } else if (savedOrg) {
        setProfileOrg(savedOrg);
      }
    } catch (e) {
      // Ignorar errores en navegadores restrictivos
    }
  }, []);

  // Sincronizar con userProfile cuando se recibe o actualiza desde el servidor
  useEffect(() => {
    if (userProfile?.name && !localStorage.getItem('judo_admin_name')) {
      setProfileName(userProfile.name);
    }
    if (userProfile?.organization) {
      setProfileOrg(userProfile.organization);
    }
  }, [userProfile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAvatarUrl(dataUrl);
        try {
          localStorage.setItem('judo_admin_avatar', dataUrl);
        } catch (err) {
          console.warn('No se pudo guardar la imagen en localStorage:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    try {
      localStorage.removeItem('judo_admin_avatar');
    } catch (err) {}
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = () => {
    try {
      localStorage.setItem('judo_admin_name', profileName);
      localStorage.setItem('judo_admin_org', profileOrg);
    } catch (err) {}
    setIsProfileModalOpen(false);
  };

  // Calcular iniciales dinámicas
  const displayInitials = React.useMemo(() => {
    const parts = profileName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return profileName.slice(0, 2).toUpperCase() || 'DT';
  }, [profileName]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('judo_sidebar_collapsed', String(next));
  };

  const tournamentIdMatch = pathname.match(/\/admin\/tournaments\/([^/?]+)/);
  const currentTournamentId = tournamentIdMatch ? tournamentIdMatch[1] : null;

  // Secciones de navegación del sidebar (Limpio y contextual por campeonato)
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
    ...(currentTournamentId
      ? [
          {
            title: 'Módulos del Torneo',
            items: [
              {
                label: 'Inscripciones',
                href: `/admin/tournaments/${currentTournamentId}?tab=roster`,
                icon: Users,
              },
              {
                label: 'Pesaje Oficial',
                href: `/admin/tournaments/${currentTournamentId}?tab=weigh_in`,
                icon: Scale,
              },
              {
                label: 'Sorteo',
                href: `/admin/tournaments/${currentTournamentId}?tab=brackets`,
                icon: Swords,
              },
              {
                label: 'Tatamis y PINs',
                href: `/admin/tournaments/${currentTournamentId}?tab=credentials`,
                icon: KeyRound,
              },
              {
                label: 'Monitor Tatamis',
                href: `/admin/tournaments/${currentTournamentId}?tab=tatamis`,
                icon: Layers,
              },
              {
                label: 'Resultados / Podio',
                href: `/admin/tournaments/${currentTournamentId}?tab=results`,
                icon: Trophy,
              },
            ],
          },
        ]
      : []),
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
                  let isActive = false;
                  if (item.href.includes('?tab=')) {
                    const currentTab = searchParams.get('tab') || 'roster';
                    const targetTab = item.href.split('?tab=')[1];
                    isActive = pathname.startsWith(item.href.split('?')[0]) && currentTab === targetTab;
                  } else {
                    isActive = pathname === item.href;
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      scroll={false}
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
        </div>

        {/* PIE DEL SIDEBAR / PERFIL DE LA ESTACIÓN */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center space-x-2.5 truncate cursor-pointer group"
                title="Personalizar perfil y foto"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-7 h-7 rounded-lg object-cover ring-1 ring-amber-500/30 group-hover:ring-amber-400 transition flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 group-hover:bg-blue-500 transition flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {displayInitials}
                  </div>
                )}
                <div className="truncate">
                  <span className="text-xs font-bold text-white group-hover:text-amber-300 transition block truncate">
                    {profileName}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {profileOrg}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <span title="Sesión Segura de Director" className="flex items-center">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </span>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  title="Ajustes de Perfil y Foto"
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
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
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                title={`Perfil: ${profileName} (Click para editar)`}
                className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-xs font-bold text-white transition cursor-pointer"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-amber-500/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                    {displayInitials}
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MODAL DE AJUSTES DE PERFIL Y FOTO DE DIRECTOR */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header del modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ajustes de Perfil de Director</h3>
                  <p className="text-[11px] text-slate-400">Personaliza tu foto, cargo y organización</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sección Foto / Avatar */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">Foto de Perfil / Logo Institucional</label>
              <div className="flex items-center space-x-4 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Previsualización"
                    className="w-16 h-16 rounded-xl object-cover ring-2 ring-amber-500/50 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-600 flex items-center justify-center text-xl font-black text-white flex-shrink-0 ring-2 ring-blue-500/30">
                    {displayInitials}
                  </div>
                )}

                <div className="space-y-2 flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
                        title="Quitar foto y usar iniciales"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Quitar Foto</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">Formatos: PNG, JPG, WebP. Máximo 2MB.</p>
                </div>
              </div>
            </div>

            {/* Inputs de Nombre y Organización */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Nombre / Cargo</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ej: Director de Torneo, Diego Paredes..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Organización / Asociación</label>
                <input
                  type="text"
                  value={profileOrg}
                  onChange={(e) => setProfileOrg(e.target.value)}
                  placeholder="Ej: Asociación Regional de Judo Iquique"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
              </div>

              {userProfile?.email && (
                <div className="pt-1">
                  <span className="text-[11px] text-slate-500">Sesión iniciada con: </span>
                  <span className="text-[11px] font-mono text-slate-400 font-bold">{userProfile.email}</span>
                </div>
              )}
            </div>

            {/* Botones de acción del modal */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
