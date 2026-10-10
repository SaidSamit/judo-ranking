-- ==============================================================================
-- MIGRACIÓN: COLUMNAS DE PROPAGACIÓN DE LLAVES Y ENLACES DE AVANCE
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_slot TEXT;

-- Índice para acelerar la búsqueda de avance de llaves
CREATE INDEX IF NOT EXISTS idx_matches_next_match_id ON matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_category ON matches(tournament_id, category_id);
