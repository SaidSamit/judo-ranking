-- ==============================================================================
-- MIGRATION: 20261102000000_allow_multicategory_registration.sql
-- DESCRIPCIÓN: Permite que un judoka participe en más de una categoría dentro del
-- mismo torneo (ej: Sub-15 y adicionalmente Cadetes Sub-18 o Absoluta).
-- Modifica la restricción de unicidad de (tournament_id, athlete_id) a
-- (tournament_id, athlete_id, category_id), evitando inscripciones duplicadas
-- en la misma llave, pero admitiendo inscripciones en llaves distintas.
-- ==============================================================================

-- 1. Eliminar la restricción previa que limitaba a una sola categoría por atleta
ALTER TABLE public.tournament_registrations DROP CONSTRAINT IF EXISTS uq_registration;

-- 2. Crear la nueva restricción compuesta (torneo + atleta + categoría)
ALTER TABLE public.tournament_registrations
ADD CONSTRAINT uq_registration UNIQUE (tournament_id, athlete_id, category_id);
