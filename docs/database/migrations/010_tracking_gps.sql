-- Tracking GPS en tiempo real: el adaptador (CMP_adaptadorTCP) envía las posiciones de los dispositivos GT06 a
-- POST /tracking/posiciones y el Backend las guarda en TRACKING_HISTORY.
-- 1. id_history pasa a generarse solo (secuencia).
-- 2. Una posición reenviada (mismo dispositivo y fecha) no se duplica: índice único (id_gps, timestamp).
-- 3. Índice para leer la última posición de cada máquina.
-- 4. Mientras llegan los LL301, la app móvil hace de GPS: un dispositivo virtual por máquina (modelo APP_MOVIL,
--    IMEI '9' + id_maquina con ceros a la izquierda, 15 dígitos; p. ej. la máquina 12 es 900000000000012) asignado
--    a su máquina. Volver a ejecutar el bloque 4 después de crear máquinas nuevas.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya incluye 1 a 3. Es idempotente.

-- 1. Secuencia de id_history (continúa después del mayor id existente)
CREATE SEQUENCE IF NOT EXISTS tracking_history_id_history_seq OWNED BY tracking_history.id_history;
ALTER TABLE tracking_history ALTER COLUMN id_history SET DEFAULT nextval('tracking_history_id_history_seq');
SELECT setval('tracking_history_id_history_seq', GREATEST((SELECT COALESCE(MAX(id_history), 0) FROM tracking_history), 1));

-- 2. Sin posiciones repetidas. Falla si ya hay filas con el mismo id_gps y timestamp: revisar con
--    SELECT id_gps, "timestamp", COUNT(*) FROM tracking_history GROUP BY 1, 2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tracking_history_gps_timestamp ON tracking_history (id_gps, "timestamp");

-- 3. Última posición por máquina
CREATE INDEX IF NOT EXISTS ix_tracking_history_maquina_timestamp ON tracking_history (id_maquina, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS ix_asignacion_gps_gps ON asignacion_gps (id_gps);

-- 4. GPS virtual de la app móvil para cada máquina
INSERT INTO dispositivo_gps (imei, modelo, estado)
SELECT '9' || LPAD(id_maquina::text, 14, '0'), 'APP_MOVIL', 'ACTIVO'
FROM maquina
ON CONFLICT (imei) DO NOTHING;

INSERT INTO asignacion_gps (id_gps, id_maquina, vigente_desde)
SELECT d.id_gps, m.id_maquina, TIMESTAMPTZ '2026-01-01 00:00:00+00'
FROM maquina m
JOIN dispositivo_gps d ON d.imei = '9' || LPAD(m.id_maquina::text, 14, '0')
WHERE NOT EXISTS (
    SELECT 1 FROM asignacion_gps a WHERE a.id_gps = d.id_gps AND a.vigente_hasta IS NULL
);
