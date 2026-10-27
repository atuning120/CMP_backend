-- Alerta de mantención o falla: cada vez que el operador marca un estado operacional de la categoría MANTENCION (en
-- rojo en el mapa) aparece una alerta 'M-<id_turno_estado>'. Como las demás, se calcula (desde TURNO_ESTADO) y no se
-- guarda: ATENCION_ALERTA debe aceptar el prefijo M para registrar quién la atendió.
-- El índice por inicio sirve para listar esas alertas por rango de fechas.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE atencion_alerta DROP CONSTRAINT IF EXISTS ck_atencion_alerta_id;
ALTER TABLE atencion_alerta ADD CONSTRAINT ck_atencion_alerta_id CHECK (id_alerta ~ '^[EJAM]-[0-9]+$');

CREATE INDEX IF NOT EXISTS idx_turno_estado_inicio ON turno_estado (inicio);
