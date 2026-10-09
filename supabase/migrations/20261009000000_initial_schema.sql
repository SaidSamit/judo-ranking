-- ==============================================================================
-- PLATAFORMA B2B GESTIÓN DE TORNEOS DE JUDO - ESQUEMA DE BASE DE DATOS DDL
-- Arquitectura: Serverless PostgreSQL (Supabase) + Multi-tenant vía RLS
-- ==============================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TIPOS ENUMERADOS (ENUMS)
-- ==============================================================================

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'CLUB_DELEGATE',
    'STATION'
);

CREATE TYPE station_type AS ENUM (
    'TATAMI_TABLE',
    'WARMUP_DISPLAY',
    'WEIGH_IN'
);

CREATE TYPE tournament_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'ACTIVE',
    'FINISHED',
    'CANCELLED'
);

CREATE TYPE weigh_in_status AS ENUM (
    'PENDING',
    'PASSED',
    'DSQ',
    'DNS'
);

CREATE TYPE match_status AS ENUM (
    'SCHEDULED',
    'ONGOING',
    'PAUSED',
    'FINISHED',
    'CANCELLED'
);

CREATE TYPE combatant_color AS ENUM (
    'WHITE',
    'BLUE'
);

CREATE TYPE point_tier AS ENUM (
    'NATIONAL_G1',
    'REGIONAL_G2',
    'FRIENDLY'
);

CREATE TYPE degradation_phase AS ENUM (
    'PHASE_100', -- 0 a 12 meses (100% del valor)
    'PHASE_50',  -- 13 a 24 meses (50% del valor)
    'EXPIRED_0'  -- >24 meses (0 puntos)
);

CREATE TYPE wallet_status AS ENUM (
    'ACTIVE',
    'FROZEN',
    'CLOSED'
);

CREATE TYPE hansoku_type AS ENUM (
    'TECHNICAL',
    'DISCIPLINARY'
);

-- ==============================================================================
-- 3. TABLAS CORE: TENANCY, IDENTIDAD Y ESTACIONES FÍSICAS
-- ==============================================================================

-- Organizaciones / Asociaciones (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    -- Catálogo flexible de reglas y puntajes (permite activar/desactivar Yuko, Koka, etc.)
    settings JSONB NOT NULL DEFAULT '{
        "allowed_scores": ["IPPON", "WAZA_ARI", "YUKO"],
        "osaekomi_rules": {
            "yuko_min_seconds": 5,
            "wazaari_min_seconds": 10,
            "ippon_seconds": 20
        },
        "default_match_duration_seconds": 240,
        "best_of_results_limit": 6
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Perfiles de Usuarios Humanos (Vinculados a auth.users de Supabase)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'CLUB_DELEGATE',
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Cuentas de Estación (Equipamiento Físico: Laptops de Mesa, Tablets Pesaje)
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                         -- Ej: 'Mesa Tatami 1', 'Báscula 1'
    slug TEXT NOT NULL,                         -- Ej: 'tatami-1', 'pesaje-1'
    type station_type NOT NULL DEFAULT 'TATAMI_TABLE',
    tatami_number INT,                          -- 1, 2, 3... (solo para TATAMI_TABLE)
    pin_hash TEXT NOT NULL,                     -- Hash bcrypt del PIN numérico (4-6 dígitos)
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_station_org_slug UNIQUE (organization_id, slug)
);

-- Clubes Deportivos
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_code TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Atletas
CREATE TABLE athletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    rut_dni TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    belt TEXT,                                  -- Cinturón / Grado (Kyu / Dan)
    nationality TEXT NOT NULL DEFAULT 'CHI',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_athlete_org_rut UNIQUE (organization_id, rut_dni)
);

-- ==============================================================================
-- 4. RANKING MULTI-BILLETERA Y PLANTILLAS DE PUNTOS
-- ==============================================================================

-- Circuitos o Ligas (Regional Tarapacá, Liga Novicios, Ranking Federado)
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Plantillas de Puntuación (Tiers)
CREATE TABLE point_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                         -- Ej: 'Nacional Grado 1'
    tier point_tier NOT NULL DEFAULT 'REGIONAL_G2',
    gold_points INT NOT NULL DEFAULT 50,
    silver_points INT NOT NULL DEFAULT 30,
    bronze_points INT NOT NULL DEFAULT 15,
    fifth_points INT NOT NULL DEFAULT 5,
    seventh_points INT NOT NULL DEFAULT 2,
    participation_points INT NOT NULL DEFAULT 0,
    -- Interruptor estricto IJF: Requiere al menos 1 victoria real en tatami para sumar.
    -- Por requerimiento de Fase 1: Apagado por defecto (false).
    requires_win_to_score BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Billeteras de Ranking (Segmentadas por Atleta + Liga + Categoría/División)
CREATE TABLE ranking_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    category_division TEXT NOT NULL,             -- Ej: 'Cadetes -60kg'
    status wallet_status NOT NULL DEFAULT 'ACTIVE',
    total_points NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    frozen_at TIMESTAMPTZ,                       -- Congelada si el atleta cambia de categoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_wallet_segment UNIQUE (athlete_id, league_id, category_division)
);

-- ==============================================================================
-- 5. TORNEOS, CATEGORÍAS Y PESAJE
-- ==============================================================================

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
    point_template_id UUID REFERENCES point_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status tournament_status NOT NULL DEFAULT 'DRAFT',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location TEXT,
    config JSONB NOT NULL DEFAULT '{
        "score_types": ["IPPON", "WAZA_ARI", "YUKO"],
        "best_of_limit": 6
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Categorías por Torneo (Oficiales o Improvisadas)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                          -- Ej: 'Cadetes Masculino -60kg'
    age_group TEXT NOT NULL,                     -- 'Infantil', 'Cadetes', 'Junior', 'Senior'
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F', 'X')),
    min_weight NUMERIC(5,2),
    max_weight NUMERIC(5,2),
    match_duration_seconds INT NOT NULL DEFAULT 240,
    is_official BOOLEAN NOT NULL DEFAULT true,   -- false si es improvisada/abierta
    assigned_tatami_number INT,                  -- Tatami designado para la cola de combates
    bracket_type TEXT NOT NULL DEFAULT 'SINGLE_ELIMINATION', -- 'SINGLE_ELIMINATION' o 'ROUND_ROBIN'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Inscripción al Torneo y Control de Pesaje en Vivo
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    registered_weight NUMERIC(5,2),
    actual_weight NUMERIC(5,2),
    weigh_in_status weigh_in_status NOT NULL DEFAULT 'PENDING',
    weigh_in_at TIMESTAMPTZ,
    final_standing INT,                          -- 1 (Oro), 2 (Plata), 3 (Bronce), etc.
    matches_won_count INT NOT NULL DEFAULT 0,    -- Contador para validar requires_win_to_score
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_registration UNIQUE (tournament_id, athlete_id)
);

-- Inyección de Puntos al Ranking y Registro Histórico (Degradación IJF)
CREATE TABLE ranking_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES ranking_wallets(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    original_points NUMERIC(10,2) NOT NULL,
    current_points NUMERIC(10,2) NOT NULL,
    degradation_phase degradation_phase NOT NULL DEFAULT 'PHASE_100',
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    phase_50_at TIMESTAMPTZ NOT NULL,            -- awarded_at + 12 meses
    expires_at TIMESTAMPTZ NOT NULL,             -- awarded_at + 24 meses
    is_valid BOOLEAN NOT NULL DEFAULT true,      -- Anulado si hubo Hansoku-make disciplinario
    CONSTRAINT uq_points_wallet_tournament UNIQUE (wallet_id, tournament_id)
);

-- ==============================================================================
-- 6. COMBATES, EVENT SOURCING (MESA DE CONTROL) Y AUDITORÍA
-- ==============================================================================

-- Combates
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    tatami_number INT NOT NULL,                  -- Tatami físico asignado
    match_number INT NOT NULL,                   -- Orden en la cola de trabajo del tatami
    round TEXT NOT NULL DEFAULT 'R16',           -- R32, R16, QF, SF, FINAL, RR1...
    white_athlete_id UUID REFERENCES athletes(id) ON DELETE SET NULL,
    blue_athlete_id UUID REFERENCES athletes(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES athletes(id) ON DELETE SET NULL,
    status match_status NOT NULL DEFAULT 'SCHEDULED',
    
    -- Snapshot del Marcador
    white_score JSONB NOT NULL DEFAULT '{"ippon": 0, "wazaari": 0, "yuko": 0, "shido": 0}'::jsonb,
    blue_score JSONB NOT NULL DEFAULT '{"ippon": 0, "wazaari": 0, "yuko": 0, "shido": 0}'::jsonb,
    
    current_match_time_seconds INT NOT NULL DEFAULT 0,
    is_golden_score BOOLEAN NOT NULL DEFAULT false,
    active_osaekomi_color combatant_color,
    osaekomi_seconds INT NOT NULL DEFAULT 0,
    
    -- Cierre y Tipificación del Combate
    win_reason TEXT,                             -- 'IPPON', 'WAZA_ARI_AWASETE_IPPON', 'HANSOKU_MAKE_INDIRECT', 'HANSOKU_MAKE_DIRECT', 'POINTS'
    hansoku_type hansoku_type,                   -- TECHNICAL vs DISCIPLINARY (diferido)
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,              -- Incrementado en cada sync offline
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Pila de Eventos Inmutables (Event Sourcing)
CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sequence_number INT NOT NULL,                -- 1, 2, 3... orden estricto en el combate
    
    -- Acción formal (ADD_*, DELETE_*, START_*, STOP_*, SWAP_*)
    action TEXT NOT NULL,
    target combatant_color,                      -- WHITE, BLUE, o NULL para reloj general
    match_time TEXT NOT NULL,                    -- Ej: '03:10'
    match_time_seconds INT NOT NULL,             -- Segundos acumulados
    
    -- Soporte para Undo específico por tecla (Shift + Key)
    is_undone BOOLEAN NOT NULL DEFAULT false,
    undone_by_event_id UUID REFERENCES match_events(id) ON DELETE SET NULL,
    
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_match_event_seq UNIQUE (match_id, sequence_number)
);

-- Logs de Auditoría Inmutables (Modo Administrador / Edición Histórica)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    performed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_by_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                        -- Ej: 'HISTORICAL_MATCH_EDIT', 'BRACKET_OVERRIDE'
    before_state JSONB NOT NULL,
    after_state JSONB NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. ÍNDICES DE RENDIMIENTO
-- ==============================================================================

CREATE INDEX idx_stations_org ON stations(organization_id);
CREATE INDEX idx_athletes_org ON athletes(organization_id);
CREATE INDEX idx_tournaments_org_status ON tournaments(organization_id, status);
CREATE INDEX idx_categories_tournament ON categories(tournament_id);
CREATE INDEX idx_registrations_tournament ON tournament_registrations(tournament_id, category_id);
CREATE INDEX idx_matches_tatami_queue ON matches(tournament_id, tatami_number, status, match_number);
CREATE INDEX idx_matches_category ON matches(category_id);
CREATE INDEX idx_match_events_match_seq ON match_events(match_id, sequence_number);
CREATE INDEX idx_match_events_action_target ON match_events(match_id, action, target, is_undone);
CREATE INDEX idx_wallets_athlete_league ON ranking_wallets(athlete_id, league_id);
CREATE INDEX idx_ranking_points_degradation ON ranking_points(degradation_phase, phase_50_at, expires_at);

-- ==============================================================================
-- 8. FUNCIONES AUXILIARES Y AUTENTICACIÓN (JWT / CLAIMS)
-- ==============================================================================

-- Función para extraer la organización actual del token JWT
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        -- Caso 1: Claim explícito inyectado por el Route Handler
        (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id', ''))::uuid,
        -- Caso 2: Metadata de usuario estándar de Supabase
        (nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'organization_id', ''))::uuid,
        -- Caso 3: App metadata
        (nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id', ''))::uuid
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Función para extraer el rol del token JWT
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
        current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger para mantener actualizado updated_at automáticamente
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_touch_organizations BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_stations BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_athletes BEFORE UPDATE ON athletes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_tournaments BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_tournament_registrations BEFORE UPDATE ON tournament_registrations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_matches BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tg_touch_ranking_wallets BEFORE UPDATE ON ranking_wallets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ==============================================================================
-- 9. PROCEDIMIENTO ALMACENADO: SINCRONIZACIÓN OFFLINE-FIRST (100% AUTORITATIVA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_offline_match(
    p_match_id UUID,
    p_final_state JSONB,
    p_events JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_org_id UUID;
    v_event JSONB;
BEGIN
    -- 1. Obtener la organización del combate
    SELECT organization_id INTO v_org_id FROM matches WHERE id = p_match_id;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Combate no encontrado: %', p_match_id;
    END IF;

    -- 2. Sobrescribir el estado del combate (Mesa de Tatami es 100% autoritativa)
    UPDATE matches
    SET
        status = (p_final_state ->> 'status')::match_status,
        white_score = p_final_state -> 'white_score',
        blue_score = p_final_state -> 'blue_score',
        winner_id = (p_final_state ->> 'winner_id')::uuid,
        win_reason = p_final_state ->> 'win_reason',
        hansoku_type = (p_final_state ->> 'hansoku_type')::hansoku_type,
        current_match_time_seconds = (p_final_state ->> 'current_match_time_seconds')::int,
        is_golden_score = COALESCE((p_final_state ->> 'is_golden_score')::boolean, false),
        started_at = COALESCE((p_final_state ->> 'started_at')::timestamptz, started_at),
        ended_at = CASE WHEN (p_final_state ->> 'status') = 'FINISHED' THEN timezone('utc'::text, now()) ELSE ended_at END,
        version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_match_id;

    -- 3. Insertar o actualizar la ráfaga de eventos en match_events
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        INSERT INTO match_events (
            id,
            organization_id,
            match_id,
            sequence_number,
            action,
            target,
            match_time,
            match_time_seconds,
            is_undone,
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
            payload = EXCLUDED.payload;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'match_id', p_match_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. POLÍTICAS DE SEGURIDAD ROW-LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Regla General: Los usuarios/estaciones solo interactúan con su tenant (organization_id)

-- ORGANIZATIONS
CREATE POLICY org_select ON organizations
    FOR SELECT USING (id = current_organization_id() OR current_organization_id() IS NULL);

-- PROFILES
CREATE POLICY profiles_all ON profiles
    FOR ALL USING (organization_id = current_organization_id());

-- STATIONS
CREATE POLICY stations_all ON stations
    FOR ALL USING (organization_id = current_organization_id());

-- CLUBS
CREATE POLICY clubs_all ON clubs
    FOR ALL USING (organization_id = current_organization_id());

-- ATHLETES
CREATE POLICY athletes_all ON athletes
    FOR ALL USING (organization_id = current_organization_id());

-- LEAGUES & POINT TEMPLATES
CREATE POLICY leagues_all ON leagues
    FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY point_templates_all ON point_templates
    FOR ALL USING (organization_id = current_organization_id());

-- TOURNAMENTS & CATEGORIES (Lectura pública para marcadores y displays; edición restringida a org)
CREATE POLICY tournaments_select ON tournaments
    FOR SELECT USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

CREATE POLICY tournaments_modify ON tournaments
    FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY categories_all ON categories
    FOR ALL USING (organization_id = current_organization_id());

-- REGISTRATIONS
CREATE POLICY registrations_all ON tournament_registrations
    FOR ALL USING (organization_id = current_organization_id());

-- MATCHES (Lectura libre dentro de org o displays; modificación restringida a org)
CREATE POLICY matches_select ON matches
    FOR SELECT USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

CREATE POLICY matches_modify ON matches
    FOR ALL USING (organization_id = current_organization_id());

-- MATCH EVENTS
CREATE POLICY match_events_select ON match_events
    FOR SELECT USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

CREATE POLICY match_events_modify ON match_events
    FOR ALL USING (organization_id = current_organization_id());

-- AUDIT LOGS (Solo inserción y lectura por ADMIN de la org; inmutable)
CREATE POLICY audit_logs_policy ON audit_logs
    FOR ALL USING (organization_id = current_organization_id());

-- RANKING WALLETS & POINTS
CREATE POLICY ranking_wallets_all ON ranking_wallets
    FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY ranking_points_all ON ranking_points
    FOR ALL USING (organization_id = current_organization_id());

-- ==============================================================================
-- 11. HABILITACIÓN DE SUPABASE REALTIME
-- ==============================================================================

-- Añadir tablas clave a la publicación de Supabase Realtime para que los monitores
-- públicos y de tatami reaccionen a cambios de inmediato sin peticiones repetitivas.
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
