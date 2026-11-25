-- Dashboard de comparación: cruza las horas del Excel del estado de pago (EP) con las horas registradas en la app.
-- Una sola view, v_comparacion: una fila por EP, equipo y jornada. El dashboard de estado de pago no cambia (sigue
-- mostrando solo el Excel). Reemplaza a la comparación eliminada en la 021, con tres diferencias: usa la app en vivo
-- (no horas congeladas), cruza también por código EP (027) y avisa los turnos sin horómetro final.
-- - Equipo: el "N° Interno" del Excel es el código EP de la máquina, su código interno o, si es solo números, el número
--   de su código interno (3228 = CF-3228). Si no calza con una sola máquina: en_flota = false.
-- - Jornada: la "Fecha" del Excel. En la app, un turno que empieza a las 12:00 o después es de la jornada siguiente
--   (migración 017). La "Hora Inicio" del Excel no se usa: el contratista la escribe por defecto (20:00 para turnos de día).
-- - estado: Coincide (hasta 0,5 h), Difiere, Solo Excel, Solo app, Falta horómetro en la app. diferencia = Excel - app.
-- - Se puede sumar por equipo, categoría o fecha. Los horómetros son el menor inicial y el mayor final de la jornada.
-- Aplicar en Aiven y en Azure, después de la 027. No afecta al Backend desplegado. schema.sql ya la incluye. Es idempotente.

BEGIN;

CREATE OR REPLACE VIEW reportes.v_comparacion AS
WITH cargas AS (
    SELECT id_carga, periodo, fecha_desde, fecha_hasta
    FROM reportes.carga
    WHERE vigente
), codigos AS (
    SELECT DISTINCT UPPER(TRIM(r.equipo)) AS codigo
    FROM reportes.carga_registro r
    JOIN cargas c ON c.id_carga = r.id_carga
), candidatas AS (
    -- Máquina de cada "N° Interno": por código EP, por código interno o, si es solo números, por el número del código
    -- interno (3228 -> CF-3228)
    SELECT co.codigo, m.id_maquina,
           RANK() OVER (PARTITION BY co.codigo
                        ORDER BY CASE WHEN UPPER(TRIM(m.codigo_ep)) = co.codigo THEN 1
                                      WHEN UPPER(TRIM(m.nombre)) = co.codigo THEN 2
                                      ELSE 3 END,
                                 COALESCE(m.estado = 'BAJA', FALSE)) AS orden
    FROM codigos co
    JOIN public.maquina m
      ON UPPER(TRIM(m.codigo_ep)) = co.codigo
      OR UPPER(TRIM(m.nombre)) = co.codigo
      OR (co.codigo ~ '^\d+$' AND SUBSTRING(UPPER(TRIM(m.nombre)) FROM '^[A-Z]+[ -]*(\d+)$') = co.codigo)
), calce AS (
    -- Con dos candidatas igual de buenas no se adivina: el equipo queda sin máquina (en_flota = false)
    SELECT codigo, MIN(id_maquina) AS id_maquina
    FROM candidatas
    WHERE orden = 1
    GROUP BY codigo
    HAVING COUNT(*) = 1
), excel AS (
    SELECT r.id_carga,
           k.id_maquina,
           CASE WHEN k.id_maquina IS NULL THEN UPPER(TRIM(r.equipo)) END AS sin_maquina,
           r.fecha AS jornada,
           STRING_AGG(DISTINCT UPPER(TRIM(r.equipo)), ', ') AS codigo,
           MAX(r.categoria) AS categoria,
           SUM(r.horas) AS horas,
           COUNT(*) AS registros,
           MIN(r.horometro_inicial) AS horometro_inicial,
           MAX(r.horometro_final) AS horometro_final
    FROM reportes.carga_registro r
    JOIN cargas c ON c.id_carga = r.id_carga
    LEFT JOIN calce k ON k.codigo = UPPER(TRIM(r.equipo))
    GROUP BY r.id_carga, k.id_maquina, sin_maquina, r.fecha
), turnos_app AS (
    SELECT h.id_turno, h.id_maquina, h.jornada, h.horas, h.horometro_inicial, h.horometro_final
    FROM reportes.v_horas_app h
    UNION ALL
    -- Cerrados por el sistema a los que nadie les ha puesto el horómetro final: no suman horas, pero se avisan
    SELECT t.id_turno, t.id_maquina,
           CASE WHEN (t.hora_inicio AT TIME ZONE 'America/Santiago')::time >= TIME '12:00'
                THEN t.fecha_turno + 1 ELSE t.fecha_turno END,
           NULL, NULL, NULL
    FROM public.turno t
    WHERE t.estado IN ('CERRADO', 'CERRADO_AUTO') AND t.horometro_final IS NULL
), app AS (
    SELECT id_maquina, jornada,
           SUM(horas) AS horas,
           COUNT(DISTINCT id_turno) AS turnos,
           COUNT(DISTINCT id_turno) FILTER (WHERE horas IS NULL) AS turnos_sin_horometro,
           MIN(horometro_inicial) AS horometro_inicial,
           MAX(horometro_final) AS horometro_final
    FROM turnos_app
    GROUP BY id_maquina, jornada
), app_ep AS (
    -- Los rangos de dos EP seguidos se topan (25-09 al 26-10 y 25-10 al 26-11): un día de la app va al EP cuyo Excel lo
    -- trae; si ninguno lo trae, solo al más nuevo
    SELECT c.id_carga, a.*
    FROM app a
    JOIN cargas c ON a.jornada BETWEEN c.fecha_desde AND c.fecha_hasta
    WHERE EXISTS (SELECT 1 FROM excel e
                  WHERE e.id_carga = c.id_carga AND e.id_maquina = a.id_maquina AND e.jornada = a.jornada)
       OR NOT EXISTS (SELECT 1 FROM cargas o
                      WHERE o.id_carga <> c.id_carga
                        AND a.jornada BETWEEN o.fecha_desde AND o.fecha_hasta
                        AND (o.periodo > c.periodo
                             OR EXISTS (SELECT 1 FROM excel e
                                        WHERE e.id_carga = o.id_carga AND e.id_maquina = a.id_maquina
                                          AND e.jornada = a.jornada)))
)
SELECT c.id_carga,
       c.periodo,
       COALESCE(e.jornada, a.jornada) AS jornada,
       m.id_maquina,
       COALESCE(m.nombre, e.sin_maquina)::VARCHAR(100) AS equipo,
       e.codigo AS codigo_excel,
       COALESCE(m.tipo_maquina, e.categoria)::VARCHAR(50) AS categoria,
       m.id_maquina IS NOT NULL AS en_flota,
       COALESCE(e.horas, 0) AS horas_excel,
       COALESCE(a.horas, 0) AS horas_app,
       COALESCE(e.horas, 0) - COALESCE(a.horas, 0) AS diferencia,
       COALESCE(e.registros, 0) AS registros_excel,
       COALESCE(a.turnos, 0) AS turnos_app,
       COALESCE(a.turnos_sin_horometro, 0) AS turnos_sin_horometro,
       e.horometro_inicial AS horometro_inicial_excel,
       a.horometro_inicial AS horometro_inicial_app,
       e.horometro_final AS horometro_final_excel,
       a.horometro_final AS horometro_final_app,
       CASE
           WHEN a.turnos_sin_horometro > 0 THEN 'Falta horómetro en la app'
           WHEN ABS(COALESCE(e.horas, 0) - COALESCE(a.horas, 0)) <= 0.5 THEN 'Coincide'
           WHEN a.id_maquina IS NULL THEN 'Solo Excel'
           WHEN e.id_carga IS NULL THEN 'Solo app'
           ELSE 'Difiere'
       END AS estado
FROM excel e
FULL JOIN app_ep a ON a.id_carga = e.id_carga AND a.id_maquina = e.id_maquina AND a.jornada = e.jornada
JOIN cargas c ON c.id_carga = COALESCE(e.id_carga, a.id_carga)
LEFT JOIN public.maquina m ON m.id_maquina = COALESCE(e.id_maquina, a.id_maquina);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_lector') THEN
        GRANT SELECT ON reportes.v_comparacion TO metabase_lector;
    END IF;
END $$;

COMMIT;

-- Verificación 1: resumen por EP y estado
SELECT to_char(periodo, 'YYYY-MM') AS periodo, estado, COUNT(*) AS jornadas, SUM(horas_excel) AS horas_excel,
       SUM(horas_app) AS horas_app, SUM(diferencia) AS diferencia
FROM reportes.v_comparacion
GROUP BY periodo, estado
ORDER BY periodo, estado;

-- Verificación 2: con qué máquina calzó cada "N° Interno". Los que salen con en_flota = false necesitan su código EP en
-- la ficha de la máquina
SELECT DISTINCT codigo_excel, equipo, categoria, en_flota
FROM reportes.v_comparacion
WHERE codigo_excel IS NOT NULL
ORDER BY en_flota, codigo_excel;
