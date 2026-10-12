// ==============================================================================
// MIDDLEWARE DE SEGURIDAD Y PROTECCIÓN DE RUTAS (NEXT.JS EDGE)
// ==============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protección de Rutas de Administración (/admin/:path*)
  if (pathname.startsWith('/admin')) {
    const adminRole = request.cookies.get('judo_admin_role')?.value;

    if (!adminRole) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('error', 'admin_session_required');
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Protección de Mesas de Control de Tatami (/tatami/:path*)
  if (pathname.startsWith('/tatami')) {
    // Modo demostración: permitido sin credenciales para capacitación y pruebas
    if (pathname === '/tatami/demo') {
      return NextResponse.next();
    }

    const adminRole = request.cookies.get('judo_admin_role')?.value;
    const stationToken = request.cookies.get('station_token')?.value;

    // Si no es Director y tampoco es una estación autenticada con PIN
    if (!adminRole && !stationToken) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('error', 'station_login_required');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/tatami/:path*'],
};
