-- Cambio de área/zona durante el turno desde la app móvil (offline-first).
-- id_cliente: UUID generado en el teléfono al registrar el cambio; hace idempotente la sincronización.
-- La ubicación inicial del turno (creada al iniciarlo) queda con id_cliente NULL.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE TURNO_UBICACION ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
