-- v_horas_excel con la misma estructura que la hoja "Base de datos" del EP: mismas columnas, mismos nombres y mismo
-- orden (ID, Equipo, N° Interno, Codigo Report, Fecha, Hora Inicio, Horometro Inicial, Horometro Final, Diferencia,
-- Area). Al final van columnas que no están en el Excel: "Horas Dia" y "Horas Noche" (la Diferencia repartida según el
-- reloj desde la hora de inicio, turno de día de 08:00 a 20:00: 18:00 con 7 h = 2 h de día y 5 h de noche; suman la
-- Diferencia) e id_carga (el filtro bloqueado del dashboard: la web elige el EP con él).
-- Versión del 2026-11-19: columnas Horas Dia / Horas Noche en vez de la columna "Turno". Si la aplicaste antes, vuelve a
-- ejecutarla entera: es idempotente y solo recrea las views.
-- 1. carga_registro guarda la columna "ID" del Excel (id_excel). Las cargas subidas antes quedan con ID vacío: volver
--    a subirlas para tenerlo.
-- 2. v_horas_excel y v_horometros_excel se vuelven a crear (cambian los nombres de columna) con los nombres del Excel.
--    En preguntas SQL de Metabase esos nombres van entre comillas dobles: SELECT "N° Interno", SUM("Diferencia") ...
-- Aplicar en Aiven y en Azure después de la 021 y antes de desplegar el Backend que guarda el ID (el Backend anterior
-- sigue funcionando con esta migración: solo deja el ID vacío). schema.sql ya la incluye. Es idempotente.

BEGIN;

-- 1. ID del Excel
ALTER TABLE reportes.carga_registro ADD COLUMN IF NOT EXISTS id_excel INT;
COMMENT ON COLUMN reportes.carga_registro.id_excel IS 'Columna "ID" del EP';

-- 2. Views con los nombres del Excel (v_horometros_excel depende de v_horas_excel: se borra primero)
DROP VIEW IF EXISTS reportes.v_horometros_excel;
DROP VIEW IF EXISTS reportes.v_horas_excel;

CREATE VIEW reportes.v_horas_excel AS
SELECT r.id_excel          AS "ID",
       r.categoria         AS "Equipo",
       r.equipo            AS "N° Interno",
       r.codigo_report     AS "Codigo Report",
       r.fecha             AS "Fecha",
       r.hora_inicio       AS "Hora Inicio",
       r.horometro_inicial AS "Horometro Inicial",
       r.horometro_final   AS "Horometro Final",
       r.horas             AS "Diferencia",
       r.area              AS "Area",
       ROUND(t.dia, 2)     AS "Horas Dia",
       r.horas - ROUND(t.dia, 2) AS "Horas Noche", -- así Horas Dia + Horas Noche = Diferencia siempre
       c.id_carga
FROM reportes.carga_registro r
JOIN reportes.carga c ON c.id_carga = r.id_carga AND c.vigente
-- inicio: hora de inicio en horas (18:30 → 18.5); resto: Diferencia sin los días completos (cada día completo suma 12 y 12)
CROSS JOIN LATERAL (
    SELECT EXTRACT(EPOCH FROM r.hora_inicio)::NUMERIC / 3600 AS inicio,
           r.horas - 24 * FLOOR(r.horas / 24)                AS resto
) h
-- dia: horas de [inicio, inicio + Diferencia] que caen de 08:00 a 20:00, de ese día (8 a 20) o del siguiente (32 a 44).
-- Sin hora de inicio no se puede repartir (NULL); con Diferencia 0 o negativa todo va al turno de la hora de inicio
CROSS JOIN LATERAL (
    SELECT CASE
               WHEN r.hora_inicio IS NULL THEN NULL
               WHEN r.horas <= 0 THEN CASE WHEN h.inicio >= 8 AND h.inicio < 20 THEN r.horas ELSE 0 END
               ELSE 12 * FLOOR(r.horas / 24)
                    + GREATEST(0, LEAST(h.inicio + h.resto, 20) - GREATEST(h.inicio, 8))
                    + GREATEST(0, LEAST(h.inicio + h.resto, 44) - GREATEST(h.inicio, 32))
           END AS dia
) t
ORDER BY c.id_carga, r.fila; -- mismo orden que el Excel al explorar la tabla en Metabase

-- Registros cuyo horómetro inicial no calza con el final del registro anterior del mismo equipo, o que terminan antes
-- de empezar. Encadenados por horómetro inicial: el turno de noche de la jornada D va antes que el de día
CREATE VIEW reportes.v_horometros_excel AS
SELECT "ID", "Equipo", "N° Interno", "Fecha", "Hora Inicio", "Area",
       "Horometro Inicial", "Horometro Final", "Horometro Final Anterior", "Salto", id_carga
FROM (
    SELECT r.id_excel          AS "ID",
           r.categoria         AS "Equipo",
           r.equipo            AS "N° Interno",
           r.fecha             AS "Fecha",
           r.hora_inicio       AS "Hora Inicio",
           r.area              AS "Area",
           r.horometro_inicial AS "Horometro Inicial",
           r.horometro_final   AS "Horometro Final",
           LAG(r.horometro_final) OVER w AS "Horometro Final Anterior",
           r.horometro_inicial - LAG(r.horometro_final) OVER w AS "Salto",
           c.id_carga,
           r.fila
    FROM reportes.carga_registro r
    JOIN reportes.carga c ON c.id_carga = r.id_carga AND c.vigente
    WINDOW w AS (PARTITION BY c.id_carga, UPPER(r.equipo) ORDER BY r.horometro_inicial, r.fecha, r.hora_inicio, r.fila)
) h
WHERE "Salto" <> 0 OR "Horometro Final" < "Horometro Inicial"
ORDER BY id_carga, fila;

-- Las views nuevas no heredan el permiso de las borradas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_lector') THEN
        GRANT SELECT ON reportes.v_horas_excel, reportes.v_horometros_excel TO metabase_lector;
    END IF;
END $$;

COMMIT;

-- Verificación 1: columnas de v_horas_excel, en el orden del Excel
SELECT ordinal_position, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'reportes' AND table_name = 'v_horas_excel'
ORDER BY ordinal_position;

-- Verificación 2: Metabase sigue viendo las 5 views (v_cargas, v_estados_app, v_horas_app, v_horas_excel,
-- v_horometros_excel)
SELECT table_name
FROM information_schema.role_table_grants
WHERE grantee = 'metabase_lector' AND table_schema = 'reportes' AND privilege_type = 'SELECT'
ORDER BY table_name;
