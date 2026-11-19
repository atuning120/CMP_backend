-- El dashboard de estado de pago muestra indicadores del Excel del contratista, ya no lo compara con la app.
-- 1. Se eliminan los objetos de la comparación: v_comparacion, v_horas_app_ep, carga_horas_app (horas de la app
--    congeladas al confirmar) y equivalencia_area (texto de "Actividad" -> área de la app).
-- 2. Formato del EP desde el #08 (oct 2026): "N° Interno" es el código de la máquina (equipo), "Equipo" es el tipo
--    (categoria) y "Area" es el texto del contratista ("Area 55", "Tacho"...). carga_registro.actividad pasa a llamarse
--    area y el dashboard agrupa por ese texto, sin cruzarlo con las áreas de la app.
-- 3. v_horas_excel solo con datos del Excel, más `turno` (Día de 06:00 a 16:59, Noche el resto: el turno de noche
--    sigue después de medianoche). v_horometros_excel se vuelve a crear encima.
-- 4. metabase_lector deja de ver las tablas base (carga, carga_registro): en Metabase solo quedan las views. Las views
--    las siguen leyendo con los permisos de su dueño.
-- Antes de aplicarla: quitar del dashboard de Metabase las tarjetas que usan v_comparacion o v_horas_app_ep.
-- Aplicar en Aiven y en Azure, después de la 020 y JUSTO ANTES de desplegar el Backend que la usa (el Backend anterior
-- escribe en carga_horas_app y en la columna actividad). schema.sql ya la incluye. Es idempotente.

BEGIN;

-- 1. Comparación (las views primero: dependen de las tablas y entre ellas)
DROP VIEW IF EXISTS reportes.v_comparacion;
DROP VIEW IF EXISTS reportes.v_horas_app_ep;
DROP VIEW IF EXISTS reportes.v_horometros_excel;
DROP VIEW IF EXISTS reportes.v_horas_excel;
DROP TABLE IF EXISTS reportes.carga_horas_app;
DROP TABLE IF EXISTS reportes.equivalencia_area;

-- 2. actividad -> area
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'reportes' AND table_name = 'carga_registro' AND column_name = 'actividad') THEN
        ALTER TABLE reportes.carga_registro RENAME COLUMN actividad TO area;
    END IF;
END $$;
COMMENT ON COLUMN reportes.carga_registro.equipo IS 'Columna "N° Interno" del EP: código interno (MAQUINA.nombre)';
COMMENT ON COLUMN reportes.carga_registro.categoria IS 'Columna "Equipo" del EP: Bulldozer, Cargador Frontal...';
COMMENT ON COLUMN reportes.carga_registro.area IS 'Columna "Area" del EP, tal como la escribe el contratista';

-- 3. Views del Excel
CREATE VIEW reportes.v_horas_excel AS
SELECT c.id_carga,
       c.periodo,
       r.id_registro,
       r.fila,
       r.equipo,
       r.categoria,
       r.codigo_report,
       r.fecha,
       r.hora_inicio,
       CASE
           WHEN r.hora_inicio IS NULL THEN NULL
           WHEN r.hora_inicio >= TIME '06:00' AND r.hora_inicio < TIME '17:00' THEN 'Día'
           ELSE 'Noche'
       END::VARCHAR(5) AS turno,
       r.horometro_inicial,
       r.horometro_final,
       r.horas,
       r.area
FROM reportes.carga_registro r
JOIN reportes.carga c ON c.id_carga = r.id_carga AND c.vigente;

CREATE VIEW reportes.v_horometros_excel AS
SELECT *
FROM (
    SELECT id_carga, periodo, id_registro, fila, equipo, categoria, fecha, hora_inicio, turno, area,
           horometro_inicial, horometro_final,
           LAG(horometro_final) OVER w AS horometro_final_anterior,
           horometro_inicial - LAG(horometro_final) OVER w AS salto
    FROM reportes.v_horas_excel
    WINDOW w AS (PARTITION BY id_carga, UPPER(equipo) ORDER BY horometro_inicial, fecha, hora_inicio, fila)
) h
WHERE salto <> 0 OR horometro_final < horometro_inicial;

-- 4. Metabase solo ve las views
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_lector') THEN
        REVOKE SELECT ON reportes.carga, reportes.carga_registro FROM metabase_lector;
        GRANT SELECT ON reportes.v_cargas, reportes.v_horas_excel, reportes.v_horometros_excel,
                        reportes.v_horas_app, reportes.v_estados_app TO metabase_lector;
    END IF;
END $$;

COMMIT;

-- Verificación 1: lo que ve Metabase. Deben salir exactamente v_cargas, v_estados_app, v_horas_app, v_horas_excel y
-- v_horometros_excel
SELECT table_name
FROM information_schema.role_table_grants
WHERE grantee = 'metabase_lector' AND table_schema = 'reportes' AND privilege_type = 'SELECT'
ORDER BY table_name;

-- Verificación 2: cargas vigentes. Si alguna se subió con el formato #08 antes de este cambio, se guardó mal (equipo =
-- "Bulldozer", sin categoría ni área: con_categoria = 0): hay que volver a subirla reemplazándola
SELECT c.id_carga, to_char(c.periodo, 'YYYY-MM') AS periodo, c.archivo, COUNT(*) AS filas,
       COUNT(r.categoria) AS con_categoria, COUNT(r.area) AS con_area,
       string_agg(DISTINCT r.equipo, ', ') AS equipos
FROM reportes.carga c
JOIN reportes.carga_registro r ON r.id_carga = c.id_carga
WHERE c.vigente
GROUP BY c.id_carga, c.periodo, c.archivo
ORDER BY c.periodo;
