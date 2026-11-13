-- ==============================================================================
-- MIGRATION: 20261101000000_update_sync_offline_match.sql
-- DESCRIPCIÓN: Actualiza el procedimiento almacenado RPC sync_offline_match
-- para utilizar las columnas atómicas individuales de puntuación (white_ippon,
-- white_wazaari, white_yuko, white_shido, blue_ippon, blue_wazaari, blue_yuko,
-- blue_shido) en lugar de los antiguos campos JSONB (white_score / blue_score).
-- Incluye compatibilidad retroactiva vía COALESCE con payloads cacheados.
-- ==============================================================================

-- 1. Eliminar versiones previas para garantizar que no existan conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.sync_offline_match(UUID, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.sync_offline_match;

-- 2. Crear la función con la lógica actualizada
CREATE OR REPLACE FUNCTION public.sync_offline_match(
    p_match_id UUID,
    p_final_state JSONB,
    p_events JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_org_id UUID;
    v_event JSONB;
BEGIN
    -- 1. Obtener la organización del combate
    SELECT organization_id INTO v_org_id FROM public.matches WHERE id = p_match_id;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Combate no encontrado: %', p_match_id;
    END IF;

    -- 2. Sobrescribir el estado del combate con columnas atómicas (Mesa de Tatami es 100% autoritativa)
    UPDATE public.matches
    SET
        status = COALESCE((p_final_state ->> 'status')::match_status, status),
        -- Columnas de puntuación Blanca
        white_ippon = COALESCE((p_final_state ->> 'white_ippon')::int, (p_final_state -> 'white_score' ->> 'ippon')::int, 0),
        white_wazaari = COALESCE((p_final_state ->> 'white_wazaari')::int, (p_final_state -> 'white_score' ->> 'wazaari')::int, 0),
        white_yuko = COALESCE((p_final_state ->> 'white_yuko')::int, (p_final_state -> 'white_score' ->> 'yuko')::int, 0),
        white_shido = COALESCE((p_final_state ->> 'white_shido')::int, (p_final_state -> 'white_score' ->> 'shido')::int, 0),
        -- Columnas de puntuación Azul
        blue_ippon = COALESCE((p_final_state ->> 'blue_ippon')::int, (p_final_state -> 'blue_score' ->> 'ippon')::int, 0),
        blue_wazaari = COALESCE((p_final_state ->> 'blue_wazaari')::int, (p_final_state -> 'blue_score' ->> 'wazaari')::int, 0),
        blue_yuko = COALESCE((p_final_state ->> 'blue_yuko')::int, (p_final_state -> 'blue_score' ->> 'yuko')::int, 0),
        blue_shido = COALESCE((p_final_state ->> 'blue_shido')::int, (p_final_state -> 'blue_score' ->> 'shido')::int, 0),
        -- Datos de resolución
        winner_id = CASE 
            WHEN p_final_state ? 'winner_id' AND (p_final_state ->> 'winner_id') IS NOT NULL 
            THEN (p_final_state ->> 'winner_id')::uuid 
            ELSE winner_id 
        END,
        win_reason = COALESCE(p_final_state ->> 'win_reason', win_reason),
        hansoku_type = CASE 
            WHEN p_final_state ? 'hansoku_type' AND (p_final_state ->> 'hansoku_type') IS NOT NULL 
            THEN (p_final_state ->> 'hansoku_type')::hansoku_type 
            ELSE hansoku_type 
        END,
        current_match_time_seconds = COALESCE((p_final_state ->> 'current_match_time_seconds')::int, current_match_time_seconds),
        is_golden_score = COALESCE((p_final_state ->> 'is_golden_score')::boolean, is_golden_score),
        started_at = COALESCE((p_final_state ->> 'started_at')::timestamptz, started_at),
        ended_at = CASE 
            WHEN (p_final_state ->> 'status') = 'FINISHED' THEN timezone('utc'::text, now()) 
            ELSE ended_at 
        END,
        version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_match_id;

    -- 3. Insertar o actualizar la ráfaga de eventos en match_events
    IF p_events IS NOT NULL AND jsonb_typeof(p_events) = 'array' THEN
        FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
        LOOP
            INSERT INTO public.match_events (
                id,
                organization_id,
                match_id,
                sequence_number,
                action,
                target,
                match_time,
                match_time_seconds,
                is_undone,
                undone_by_event_id,
                payload,
                created_at
            ) VALUES (
                COALESCE((v_event ->> 'id')::uuid, gen_random_uuid()),
                v_org_id,
                p_match_id,
                (v_event ->> 'sequence_number')::int,
                v_event ->> 'action',
                (v_event ->> 'target')::combatant_color,
                v_event ->> 'match_time',
                (v_event ->> 'match_time_seconds')::int,
                COALESCE((v_event ->> 'is_undone')::boolean, false),
                CASE 
                    WHEN (v_event ->> 'undone_by_event_id') IS NOT NULL AND (v_event ->> 'undone_by_event_id') <> '' 
                    THEN (v_event ->> 'undone_by_event_id')::uuid 
                    ELSE NULL 
                END,
                COALESCE(v_event -> 'payload', '{}'::jsonb),
                COALESCE((v_event ->> 'created_at')::timestamptz, timezone('utc'::text, now()))
            )
            ON CONFLICT (match_id, sequence_number) DO UPDATE
            SET
                action = EXCLUDED.action,
                target = EXCLUDED.target,
                match_time = EXCLUDED.match_time,
                match_time_seconds = EXCLUDED.match_time_seconds,
                is_undone = EXCLUDED.is_undone,
                undone_by_event_id = EXCLUDED.undone_by_event_id,
                payload = EXCLUDED.payload;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'match_id', p_match_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Asignación de permisos de ejecución
GRANT EXECUTE ON FUNCTION public.sync_offline_match(UUID, JSONB, JSONB) TO authenticated, service_role, anon;
