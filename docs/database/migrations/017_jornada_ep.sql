-- Jornada del estado de pago: en el Excel del contratista la "Fecha" es la jornada, que empieza con el turno de noche
-- de la tarde anterior (los registros de la jornada D van noche ~18:00 del día D-1 y luego día ~07:00 del día D; así
-- encadenan los horómetros del EP de junio 2026). En la app, TURNO.fecha_turno es el día en que empieza el turno.
-- 1. `jornada` en las horas de la app (y en las congeladas): fecha_turno + 1 si el turno empieza a las 12:00 o después.
-- 2. La comparación cruza Excel y App por jornada (antes por fecha: descuadraba todos los turnos de noche).
-- 3. Los horómetros del Excel se encadenan por horómetro inicial, no por fecha y hora (por lo mismo).
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven), después de la 016. schema.sql ya lo incluye.
-- Es idempotente.

-- 1. Jornada en las horas de la app
ALTER TABLE reportes.carga_horas_app ADD COLUMN IF NOT EXISTS jornada DATE;
UPDATE reportes.carga_horas_app
SET jornada = CASE WHEN hora_inicio >= TIME '12:00' THEN fecha + 1 ELSE fecha END
WHERE jornada IS NULL;
ALTER TABLE reportes.carga_horas_app ALTER COLUMN jornada SET NOT NULL;

CREATE OR REPLACE VIEW reportes.v_horas_app AS
WITH turnos AS (
    SELECT t.id_turno, t.id_maquina, t.fecha_turno, t.hora_inicio, t.hora_termino,
           t.horometro_inicial, t.horometro_final, t.horometro_final - t.horometro_inicial AS horas, t.conflicto
    FROM public.turno t
    WHERE t.estado IN ('CERRADO', 'CERRADO_AUTO') AND t.horometro_final IS NOT NULL
), tramos AS (
    SELECT u.id_turno, u.id_area,
           SUM(GREATEST(EXTRACT(EPOCH FROM LEAST(COALESCE(u.fin, tu.hora_termino), tu.hora_termino)
                                        - GREATEST(u.inicio, tu.hora_inicio)), 0)) AS segundos
    FROM public.turno_ubicacion u
    JOIN turnos tu ON tu.id_turno = u.id_turno
    GROUP BY u.id_turno, u.id_area
), reparto AS (
    SELECT id_turno, id_area,
           COALESCE(segundos / NULLIF(SUM(segundos) OVER (PARTITION BY id_turno), 0),
                    1.0 / COUNT(*) OVER (PARTITION BY id_turno)) AS fraccion
    FROM tramos
)
SELECT tu.id_turno,
       tu.id_maquina,
       m.nombre AS equipo,
       m.tipo_maquina AS categoria,
       tu.fecha_turno AS fecha,
       (tu.hora_inicio AT TIME ZONE 'America/Santiago')::time AS hora_inicio,
       tu.horometro_inicial,
       tu.horometro_final,
       ROUND(tu.horas * COALESCE(r.fraccion, 1), 2) AS horas,
       r.id_area,
       a.nombre AS area,
       tu.conflicto,
       CASE WHEN (tu.hora_inicio AT TIME ZONE 'America/Santiago')::time >= TIME '12:00'
            THEN tu.fecha_turno + 1 ELSE tu.fecha_turno END AS jornada
FROM turnos tu
JOIN public.maquina m ON m.id_maquina = tu.id_maquina
LEFT JOIN reparto r ON r.id_turno = tu.id_turno
LEFT JOIN public.area a ON a.id_area = r.id_area;

CREATE OR REPLACE VIEW reportes.v_horas_excel AS
SELECT c.id_carga,
       c.periodo,
       r.id_registro,
       r.fila,
       mq.id_maquina,
       r.equipo,
       r.categoria,
       r.codigo_report,
       r.fecha,
       r.hora_inicio,
       r.horometro_inicial,
       r.horometro_final,
       r.horas,
       r.actividad,
       a.id_area,
       a.nombre AS area,
       r.fecha AS jornada
FROM reportes.carga_registro r
JOIN reportes.carga c ON c.id_carga = r.id_carga AND c.vigente
LEFT JOIN public.maquina mq ON UPPER(mq.nombre) = UPPER(r.equipo)
LEFT JOIN reportes.equivalencia_area eq ON eq.texto = LOWER(TRIM(r.actividad))
LEFT JOIN LATERAL (
    SELECT ar.id_area
    FROM public.area ar
    WHERE COALESCE(NULLIF(ar.codigo, ''), SUBSTRING(ar.nombre FROM '(\d+)'))
          = SUBSTRING(r.actividad FROM '^\s*[ÁáAa]rea\s+(\d+)')
    ORDER BY ar.id_area
    LIMIT 1
) num ON TRUE
LEFT JOIN public.area a ON a.id_area = COALESCE(eq.id_area, num.id_area);

CREATE OR REPLACE VIEW reportes.v_horas_app_ep AS
SELECT c.id_carga,
       c.periodo,
       s.id_turno,
       s.id_maquina,
       s.equipo,
       s.categoria,
       s.fecha,
       s.hora_inicio,
       s.horometro_inicial,
       s.horometro_final,
       s.horas,
       s.id_area,
       s.area,
       s.conflicto,
       s.jornada
FROM reportes.carga_horas_app s
JOIN reportes.carga c ON c.id_carga = s.id_carga AND c.vigente;

-- 2. Comparación por jornada (cambia la columna fecha por jornada: se vuelve a crear)
DROP VIEW IF EXISTS reportes.v_comparacion;
CREATE VIEW reportes.v_comparacion AS
WITH excel AS (
    SELECT id_carga, UPPER(equipo) AS equipo, MAX(categoria) AS categoria, jornada,
           SUM(horas) AS horas, COUNT(*) AS registros
    FROM reportes.v_horas_excel
    GROUP BY id_carga, UPPER(equipo), jornada
), app AS (
    SELECT id_carga, UPPER(equipo) AS equipo, MAX(categoria) AS categoria, jornada,
           SUM(horas) AS horas, COUNT(DISTINCT id_turno) AS turnos
    FROM reportes.v_horas_app_ep
    GROUP BY id_carga, UPPER(equipo), jornada
)
SELECT c.id_carga,
       c.periodo,
       COALESCE(e.equipo, a.equipo) AS equipo,
       COALESCE(e.categoria, a.categoria) AS categoria,
       COALESCE(e.jornada, a.jornada) AS jornada,
       e.horas AS horas_excel,
       a.horas AS horas_app,
       COALESCE(e.horas, 0) - COALESCE(a.horas, 0) AS diferencia,
       COALESCE(e.registros, 0) AS registros_excel,
       COALESCE(a.turnos, 0) AS turnos_app,
       CASE
           WHEN a.equipo IS NULL THEN 'SOLO_EXCEL'
           WHEN e.equipo IS NULL THEN 'SOLO_APP'
           WHEN ABS(e.horas - a.horas) <= 0.5 THEN 'COINCIDE'
           ELSE 'DIFIERE'
       END AS estado
FROM excel e
FULL JOIN app a ON a.id_carga = e.id_carga AND a.equipo = e.equipo AND a.jornada = e.jornada
JOIN reportes.carga c ON c.id_carga = COALESCE(e.id_carga, a.id_carga);

-- 3. Horómetros encadenados por horómetro inicial
CREATE OR REPLACE VIEW reportes.v_horometros_excel AS
SELECT *
FROM (
    SELECT id_carga, periodo, id_registro, fila, equipo, categoria, fecha, hora_inicio,
           horometro_inicial, horometro_final,
           LAG(horometro_final) OVER w AS horometro_final_anterior,
           horometro_inicial - LAG(horometro_final) OVER w AS salto
    FROM reportes.v_horas_excel
    WINDOW w AS (PARTITION BY id_carga, UPPER(equipo) ORDER BY horometro_inicial, fecha, hora_inicio, fila)
) h
WHERE salto <> 0 OR horometro_final < horometro_inicial;

GRANT SELECT ON ALL TABLES IN SCHEMA reportes TO metabase_lector;
