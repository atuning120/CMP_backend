-- Estados de la máquina: además de ACTIVA (Operativo) y BAJA (Fuera de servicio), se agregan
-- BAJO_OBSERVACION, EN_MANTENIMIENTO y EN_RESERVA. "Sin operador" no se guarda: se deduce de la asignación.
-- La bitácora suma la acción CAMBIAR_ESTADO (cambios entre estados que no son BAJA).
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE maquina DROP CONSTRAINT IF EXISTS maquina_estado_check;
ALTER TABLE maquina ADD CONSTRAINT maquina_estado_check
    CHECK (estado IN ('ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'BAJA'));

ALTER TABLE bitacora_jefe_turno DROP CONSTRAINT IF EXISTS bitacora_jefe_turno_accion_check;
ALTER TABLE bitacora_jefe_turno ADD CONSTRAINT bitacora_jefe_turno_accion_check
    CHECK (accion IN ('INCORPORAR', 'EDITAR', 'HABILITAR', 'DESHABILITAR', 'CAMBIAR_ESTADO', 'REEMPLAZAR'));
