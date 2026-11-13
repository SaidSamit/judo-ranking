// ==============================================================================
// MIDDLEWARE DE SEGURIDAD Y PROTECCIÓN DE RUTAS (NEXT.JS EDGE)
// ==============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminRole = request.cookies.get('judo_admin_role')?.value;
  const stationToken = request.cookies.get('station_token')?.value;

  // Extraer claims de la estación si existe token
  let stationType: string | undefined;
  let stationSlug: string | undefined;

  if (stationToken) {
    try {
      const payload = decodeJwt(stationToken) as any;
      stationType = payload.type || payload.user_metadata?.station_type;
      stationSlug = payload.slug || payload.user_metadata?.station_slug;
    } catch {
      stationType = undefined;
      stationSlug = undefined;
    }
  }

  // 1. Protección de Rutas de Administración (/admin/:path*)
  if (pathname.startsWith('/admin')) {
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

    // Si no es Director y tampoco es una estación autenticada con PIN
    if (!adminRole && !stationToken) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('error', 'station_login_required');
      return NextResponse.redirect(loginUrl);
    }

    // Regla de Negocio: Si la estación es de tipo WEIGH_IN, bloquear acceso a tatami
    if (!adminRole && stationType === 'WEIGH_IN') {
      const targetSlug = stationSlug || 'pesaje-varones';
      return NextResponse.redirect(new URL(`/pesaje/${targetSlug}`, request.url));
    }
  }

  // 3. Protección de Estaciones de Pesaje (/pesaje/:path*)
  if (pathname.startsWith('/pesaje')) {
    // Si no es Director y tampoco es una estación autenticada con PIN
    if (!adminRole && !stationToken) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('error', 'station_login_required');
      return NextResponse.redirect(loginUrl);
    }

    // Regla de Negocio: Si la estación es de tipo TATAMI_TABLE, bloquear acceso a pesaje
    if (!adminRole && stationType === 'TATAMI_TABLE') {
      const targetSlug = stationSlug || 'tatami-1';
      return NextResponse.redirect(new URL(`/tatami/${targetSlug}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/tatami/:path*', '/pesaje/:path*'],
};
