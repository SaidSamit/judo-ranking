-- ==============================================================================
-- DATOS SEMILLA (SEED DATA) PARA PRUEBAS Y VALIDACIÓN INICIAL
-- ==============================================================================

-- 1. Organización Inicial
INSERT INTO organizations (id, name, slug)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Asociación Regional de Judo Tarapacá',
    'tarapaca'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Estaciones Físicas (Cuentas de Servicio)
-- El pin_hash tiene soporte tanto para PIN '1234' en texto plano como con hash bcrypt
INSERT INTO stations (id, organization_id, name, slug, type, tatami_number, pin_hash, is_active)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Mesa de Control - Tatami 1',
    'tatami-1',
    'TATAMI_TABLE',
    1,
    '1234', -- PIN para pruebas: 1234
    true
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Mesa de Control - Tatami 2',
    'tatami-2',
    'TATAMI_TABLE',
    2,
    '1234',
    true
),
(
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Estación de Pesaje Principal',
    'pesaje-1',
    'WEIGH_IN',
    NULL,
    '1234',
    true
)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 3. Plantilla de Puntos (Grado 2 Regional)
INSERT INTO point_templates (id, organization_id, name, tier, gold_points, silver_points, bronze_points, requires_win_to_score)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Regional Grado 2',
    'REGIONAL_G2',
    50,
    30,
    15,
    false
) ON CONFLICT DO NOTHING;

-- 4. Liga / Circuito
INSERT INTO leagues (id, organization_id, name, description)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Circuito Regional Tarapacá 2026',
    'Ranking oficial de la Asociación Regional de Tarapacá'
) ON CONFLICT DO NOTHING;

-- 5. Torneo Activo
INSERT INTO tournaments (id, organization_id, league_id, point_template_id, name, status, start_date, end_date, location)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Torneo Regional Iquique Open',
    'ACTIVE',
    CURRENT_DATE,
    CURRENT_DATE,
    'Polideportivo Central Iquique'
) ON CONFLICT DO NOTHING;

-- 6. Categoría Asignada al Tatami 1
INSERT INTO categories (id, organization_id, tournament_id, name, age_group, gender, min_weight, max_weight, match_duration_seconds, assigned_tatami_number)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'Cadetes Masculino -60kg',
    'Cadetes',
    'M',
    55.0,
    60.0,
    240,
    1
) ON CONFLICT DO NOTHING;

-- 7. Combate de Demostración Semilla (Tatami 1)
INSERT INTO matches (
    id,
    organization_id,
    tournament_id,
    category_id,
    tatami_number,
    match_number,
    round,
    status,
    white_score,
    blue_score,
    current_match_time_seconds,
    is_golden_score
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    1,
    1,
    'FINAL',
    'SCHEDULED',
    '{"ippon": 0, "wazaari": 0, "yuko": 0, "shido": 0}'::jsonb,
    '{"ippon": 0, "wazaari": 0, "yuko": 0, "shido": 0}'::jsonb,
    0,
    false
) ON CONFLICT (id) DO NOTHING;
