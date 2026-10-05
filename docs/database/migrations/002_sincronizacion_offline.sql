-- Soporte offline-first de la app móvil.
-- id_cliente: UUID generado en el teléfono al registrar la acción (aunque esté sin conexión).
--   Hace idempotente la sincronización: reenviar la misma operación no duplica registros.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya lo incluye.

ALTER TABLE TURNO ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
-- Turno aceptado aunque chocaba con otro (p. ej. máquina con turno activo de otro operador al
-- sincronizar un inicio offline). Queda marcado para revisión del jefe de turno.
ALTER TABLE TURNO ADD COLUMN IF NOT EXISTS conflicto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE TURNO ADD COLUMN IF NOT EXISTS conflicto_detalle TEXT;

ALTER TABLE TURNO_ESTADO ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
ALTER TABLE REPORTE_TURNO ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
ALTER TABLE EVIDENCIA ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;

-- NOVEDAD: reporte durante el turno (p. ej. foto de una falla), además de INICIO y FIN
ALTER TABLE REPORTE_TURNO DROP CONSTRAINT IF EXISTS reporte_turno_tipo_check;
ALTER TABLE REPORTE_TURNO ADD CONSTRAINT reporte_turno_tipo_check CHECK (tipo IN ('INICIO', 'FIN', 'NOVEDAD'));
