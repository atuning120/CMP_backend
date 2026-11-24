-- Gestión de GPS desde el panel web (módulo gps): vincular, mover y desvincular los GPS reales (Jimi LL301).
-- Con el Backend nuevo, mientras una máquina tiene un GPS real vigente se ignoran las posiciones que manda la app móvil
-- para esa máquina. Por eso, antes de desplegarlo:
-- 1. Los GPS sintéticos del seed (IMEI 864201040001001 a 864201040001020) quedan fuera de uso: si alguno seguía vigente
--    en una máquina, la app dejaría de ubicarla.
-- 2. Un GPS con más de una asignación vigente se queda con la más reciente.
-- 3. Índice único: un GPS está en una sola máquina a la vez. Índice por máquina.
-- 4. Se reabre el GPS virtual de la app que se cerró al vincular a mano un GPS real (mismo instante): ya no hace falta
--    cerrarlo, y así la app vuelve a servir si ese GPS se cambia de máquina.
-- Aplicar en Azure y Aiven ANTES de desplegar el Backend (idealmente justo antes). schema.sql y seed.sql ya la incluyen.
-- Es idempotente.

BEGIN;

-- 1. GPS del seed
UPDATE asignacion_gps a SET vigente_hasta = CURRENT_TIMESTAMP
FROM dispositivo_gps d
WHERE d.id_gps = a.id_gps AND a.vigente_hasta IS NULL AND d.imei BETWEEN '864201040001001' AND '864201040001020';

UPDATE dispositivo_gps SET estado = 'INACTIVO'
WHERE imei BETWEEN '864201040001001' AND '864201040001020' AND estado IS DISTINCT FROM 'INACTIVO';

-- 2. Una asignación vigente por GPS
UPDATE asignacion_gps a SET vigente_hasta = GREATEST(a.vigente_desde, s.vigente_desde)
FROM (
    SELECT DISTINCT ON (id_gps) id_gps, id_asignacion, vigente_desde
    FROM asignacion_gps
    WHERE vigente_hasta IS NULL
    ORDER BY id_gps, vigente_desde DESC, id_asignacion DESC
) s
WHERE s.id_gps = a.id_gps AND a.vigente_hasta IS NULL AND a.id_asignacion <> s.id_asignacion;

-- 4. GPS virtual cerrado al vincular un GPS real a mano (antes del índice único: respeta una ya abierta)
UPDATE asignacion_gps a SET vigente_hasta = NULL
FROM dispositivo_gps d
WHERE d.id_gps = a.id_gps AND d.modelo = 'APP_MOVIL' AND a.vigente_hasta IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM asignacion_gps r
      JOIN dispositivo_gps dr ON dr.id_gps = r.id_gps AND dr.modelo IS DISTINCT FROM 'APP_MOVIL'
      WHERE r.id_maquina = a.id_maquina AND r.vigente_desde = a.vigente_hasta
  )
  AND NOT EXISTS (SELECT 1 FROM asignacion_gps o WHERE o.id_gps = a.id_gps AND o.vigente_hasta IS NULL);

-- 3. Índices
CREATE UNIQUE INDEX IF NOT EXISTS ux_asignacion_gps_vigente ON asignacion_gps (id_gps) WHERE vigente_hasta IS NULL;
CREATE INDEX IF NOT EXISTS ix_asignacion_gps_maquina ON asignacion_gps (id_maquina);

COMMIT;

-- Comprobación: los GPS reales vigentes y su máquina (no debe aparecer ninguno 864201040001…)
SELECT d.imei, d.modelo, d.estado, m.id_maquina, m.nombre, a.vigente_desde
FROM asignacion_gps a
JOIN dispositivo_gps d ON d.id_gps = a.id_gps
JOIN maquina m ON m.id_maquina = a.id_maquina
WHERE a.vigente_hasta IS NULL AND d.modelo IS DISTINCT FROM 'APP_MOVIL'
ORDER BY m.nombre;
