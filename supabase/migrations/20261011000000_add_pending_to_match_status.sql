-- ==============================================================================
-- MIGRACIÓN: AGREGAR ESTADO 'PENDING' AL ENUM match_status
-- ==============================================================================
-- En llaves de eliminación (cuartos, semifinales, finales), los combates futuros
-- cuyos competidores aún no se han definido porque dependen de los ganadores de
-- las rondas anteriores se registran en estado 'PENDING'.
-- Al culminar un combate previo, el ganador avanza automáticamente y cuando
-- ambos atletas están listos, el estado del combate es promovido a 'SCHEDULED'.

ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'PENDING';
