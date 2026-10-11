-- ==============================================================================
-- MIGRACIÓN: AISLAMIENTO DE ESTACIONES POR TORNEO Y CREDENCIALES NATIVAS (PIN)
-- ==============================================================================
-- 1. Permite vincular cada mesa de control (tatami) a su torneo específico.
-- 2. Almacena el PIN numérico de acceso de forma nativa en la estación para que
--    el Director del Torneo pueda consultar e imprimir las credenciales sin recurrir
--    a campos de configuración JSONB no tipados.
-- 3. Remueve la restricción global uq_station_org_slug para permitir tatamis
--    independientes por cada torneo dentro de la misma organización.
-- ==============================================================================

-- 1. Agregar columnas en la tabla 'stations'
ALTER TABLE stations ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS pin_code TEXT;

-- 2. Eliminar la restricción que impedía reutilizar slugs (ej: tatami-1) entre torneos distintos
ALTER TABLE stations DROP CONSTRAINT IF EXISTS uq_station_org_slug;

-- 3. Crear índices únicos por torneo para evitar tatamis duplicados en el mismo evento
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_tournament_tatami 
  ON stations (tournament_id, tatami_number) 
  WHERE tournament_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_tournament_slug 
  ON stations (tournament_id, slug) 
  WHERE tournament_id IS NOT NULL;

-- 4. Mantener unicidad para estaciones globales sin torneo específico (ej: báscula general)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_org_slug_global 
  ON stations (organization_id, slug) 
  WHERE tournament_id IS NULL;
