import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

interface StationLoginBody {
  slug?: string;
  station_slug?: string;
  pin: string;
  organization_slug?: string;
  organization_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StationLoginBody;
    const slug = (body.slug || body.station_slug || '').trim();
    const pin = (body.pin || '').trim();
    const organizationSlug = body.organization_slug?.trim();
    const organizationId = body.organization_id?.trim();

    // 1. Validaciones de entrada
    if (!slug) {
      return NextResponse.json(
        { error: 'El identificador (slug) de la estación es obligatorio.' },
        { status: 400 }
      );
    }

    if (!pin || pin.length < 4) {
      return NextResponse.json(
        { error: 'El PIN numérico debe tener al menos 4 dígitos.' },
        { status: 400 }
      );
    }

    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERROR CRÍTICO: SUPABASE_JWT_SECRET no configurado en variables de entorno.');
      return NextResponse.json(
        { error: 'Error de configuración del servidor (JWT Secret missing).' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 2. Resolver organization_id si se especificó organization_slug
    let resolvedOrgId = organizationId;
    if (!resolvedOrgId && organizationSlug) {
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', organizationSlug)
        .single();

      if (orgError || !orgData) {
        return NextResponse.json(
          { error: `Organización "${organizationSlug}" no encontrada.` },
          { status: 404 }
        );
      }
      resolvedOrgId = orgData.id;
    }

    // 3. Buscar la estación en la base de datos
    let stationQuery = supabaseAdmin
      .from('stations')
      .select('id, organization_id, name, slug, type, tatami_number, pin_hash, is_active')
      .eq('slug', slug)
      .eq('is_active', true);

    if (resolvedOrgId) {
      stationQuery = stationQuery.eq('organization_id', resolvedOrgId);
    }

    const { data: stations, error: stationError } = await stationQuery;

    if (stationError) {
      console.error('Error buscando estación:', stationError);
      return NextResponse.json(
        { error: 'Error al consultar la base de datos de estaciones.' },
        { status: 500 }
      );
    }

    if (!stations || stations.length === 0) {
      return NextResponse.json(
        { error: 'Estación no encontrada o dada de baja en el inventario.' },
        { status: 404 }
      );
    }

    if (stations.length > 1 && !resolvedOrgId) {
      return NextResponse.json(
        {
          error:
            'Existen múltiples estaciones con ese slug en distintas asociaciones. Por favor especifica "organization_slug".',
        },
        { status: 409 }
      );
    }

    const station = stations[0];

    // 4. Verificar el PIN contra el hash almacenado (bcrypt con fallback)
    let isPinValid = false;
    try {
      isPinValid = await bcrypt.compare(pin, station.pin_hash);
    } catch {
      isPinValid = false;
    }

    // Fallback de desarrollo por si se insertó PIN en texto plano en pruebas o seed
    if (!isPinValid && station.pin_hash === pin) {
      isPinValid = true;
    }

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'PIN de acceso incorrecto para esta estación.' },
        { status: 401 }
      );
    }

    // 5. Actualizar última conexión (last_seen_at) de la estación
    await supabaseAdmin
      .from('stations')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', station.id);

    // 6. Firmar el JWT con Custom Claims para Supabase RLS
    // Duración: 7 días para tolerar fines de semana completos de torneo sin interrupciones
    const expirationSeconds = 7 * 24 * 60 * 60;
    const secretKey = new TextEncoder().encode(jwtSecret);

    const accessToken = await new SignJWT({
      // Claim de compatibilidad directa para RLS
      organization_id: station.organization_id,
      // Claims requeridos por PostgREST / Supabase
      role: 'authenticated',
      email: `${station.slug}@station.internal`,
      app_metadata: {
        provider: 'station_pin',
        role: 'STATION',
        organization_id: station.organization_id,
      },
      user_metadata: {
        role: 'STATION',
        station_id: station.id,
        station_name: station.name,
        station_slug: station.slug,
        station_type: station.type,
        tatami_number: station.tatami_number,
        organization_id: station.organization_id,
      },
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(station.id)
      .setAudience('authenticated')
      .setIssuer('judo-ranking-auth')
      .setIssuedAt()
      .setExpirationTime(`${expirationSeconds}s`)
      .sign(secretKey);

    // 7. Responder con el token y datos de la estación + Cookie de respaldo
    const response = NextResponse.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expirationSeconds,
      station: {
        id: station.id,
        name: station.name,
        slug: station.slug,
        type: station.type,
        tatami_number: station.tatami_number,
        organization_id: station.organization_id,
      },
    });

    // Guardar cookie HTTP-only para navegación transparente en Server Components
    response.cookies.set('station_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expirationSeconds,
    });

    return response;
  } catch (error) {
    console.error('Error no controlado en /api/auth/station-login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor procesando la autenticación de estación.' },
      { status: 500 }
    );
  }
}
