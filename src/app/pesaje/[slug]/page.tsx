// ==============================================================================
// RUTA DINÁMICA: ESTACIÓN DE PESAJE INDEPENDIENTE (/pesaje/[slug])
// ==============================================================================

import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeJwt } from 'jose';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWeighInAthletesAction } from '@/app/actions/weigh-in';
import { StationWeighInView } from '@/components/weigh-in/station-weigh-in-view';

interface WeighInPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WeighInStationPage({ params }: WeighInPageProps) {
  const { slug } = await params;

  // 1. Verificación de Seguridad
  const cookieStore = await cookies();
  const adminRole = cookieStore.get('judo_admin_role')?.value;
  const stationToken = cookieStore.get('station_token')?.value;

  if (!adminRole && !stationToken) {
    redirect('/?error=station_login_required');
  }

  // 2. Extraer información del token de estación si existe
  let tokenStationId: string | undefined;
  let tokenTournamentId: string | undefined;
  let tokenType: string | undefined;
  let tokenMetadata: any = undefined;

  if (stationToken) {
    try {
      const payload = decodeJwt(stationToken) as any;
      tokenStationId = payload.station_id;
      tokenTournamentId = payload.tournament_id;
      tokenType = payload.type;
      tokenMetadata = payload.metadata;
    } catch {
      // Ignorar si el token no puede decodificarse
    }
  }

  const supabase = createAdminClient();

  // 3. Resolver la estación y su torneo asociado
  let stationData: any = null;
  let targetTournamentId: string | null = tokenTournamentId || null;

  if (tokenStationId) {
    const { data: st } = await supabase
      .from('stations')
      .select('id, name, slug, type, metadata, tournament_id')
      .eq('id', tokenStationId)
      .maybeSingle();

    if (st) {
      stationData = st;
      targetTournamentId = st.tournament_id || targetTournamentId;
    }
  }

  // Si no se encontró por ID o es sesión de Director supervisando por slug
  if (!stationData) {
    // Si no tenemos torneo de contexto, tomar el torneo activo
    if (!targetTournamentId) {
      const { data: activeTour } = await supabase
        .from('tournaments')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      targetTournamentId = activeTour?.id || 'e0000000-0000-0000-0000-000000000001';
    }

    const { data: st } = await supabase
      .from('stations')
      .select('id, name, slug, type, metadata, tournament_id')
      .eq('tournament_id', targetTournamentId)
      .eq('slug', slug)
      .maybeSingle();

    stationData = st;
  }

  const effectiveTournamentId =
    targetTournamentId ||
    stationData?.tournament_id ||
    'e0000000-0000-0000-0000-000000000001';

  // 4. Consultar datos del torneo
  const { data: tourData } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('id', effectiveTournamentId)
    .maybeSingle();

  const tournamentName = tourData?.name || 'Campeonato Oficial';

  // 5. Cargar lista inicial de judokas para el pesaje
  const athletesRes = await getWeighInAthletesAction(effectiveTournamentId);
  const initialAthletes = athletesRes.athletes || [];

  // Metadata por defecto según convención del slug si la base viniera vacía
  let resolvedMetadata = stationData?.metadata || tokenMetadata || {};
  if (!resolvedMetadata.gender_filter) {
    if (slug.includes('varones')) resolvedMetadata = { ...resolvedMetadata, gender_filter: 'M' };
    else if (slug.includes('damas')) resolvedMetadata = { ...resolvedMetadata, gender_filter: 'F' };
  }

  return (
    <StationWeighInView
      station={{
        id: stationData?.id || `station-${slug}`,
        name: stationData?.name || `Estación de Pesaje (${slug})`,
        slug: stationData?.slug || slug,
        type: stationData?.type || tokenType || 'WEIGH_IN',
        metadata: resolvedMetadata,
      }}
      tournament={{
        id: effectiveTournamentId,
        name: tournamentName,
      }}
      initialAthletes={initialAthletes}
    />
  );
}

