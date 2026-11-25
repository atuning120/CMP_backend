-- Regularización del horómetro: un turno que el sistema cerró a las 13 h queda sin horómetro final. El jefe de turno lo
-- informa desde la alerta de cierre automático (app o panel web).
-- 1. TURNO.horometro_regularizado_por: quién lo informó. Si después llega el cierre que el operador hizo sin señal, se
--    conserva su lectura y el turno queda marcado para revisión.
-- 2. BITACORA_JEFE_TURNO: nueva acción REGULARIZAR, para que aparezca en el historial y en el Excel.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven), ANTES de desplegar el Backend. schema.sql ya
-- lo incluye. Es idempotente.

ALTER TABLE turno ADD COLUMN IF NOT EXISTS horometro_regularizado_por INT;

ALTER TABLE turno DROP CONSTRAINT IF EXISTS fk_turno_horometro_regularizado_por;
ALTER TABLE turno ADD CONSTRAINT fk_turno_horometro_regularizado_por
    FOREIGN KEY (horometro_regularizado_por) REFERENCES usuario(id_usuario) ON DELETE SET NULL;

ALTER TABLE bitacora_jefe_turno DROP CONSTRAINT IF EXISTS bitacora_jefe_turno_accion_check;
ALTER TABLE bitacora_jefe_turno ADD CONSTRAINT bitacora_jefe_turno_accion_check
    CHECK (accion IN ('INCORPORAR', 'EDITAR', 'HABILITAR', 'DESHABILITAR', 'CAMBIAR_ESTADO', 'REEMPLAZAR', 'DEVOLVER', 'REGULARIZAR'));
