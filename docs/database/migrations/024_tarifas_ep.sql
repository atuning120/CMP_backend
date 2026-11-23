-- Tarifas del EP para Metabase: de la hoja "EP #NN MLC" del Excel (el número cambia con cada EP: el archivo
-- "EP #08 MLC 10.2026.xlsx" trae la hoja "EP #08 MLC") se guardan las tablas "Tarifas garantizadas" (ítems 1.x) y
-- "Tarifas diferenciadas" (ítems 2.x): Item, Descripcion, Unidad, Cantidad, P. Unitario y Total. Nada más de esa hoja.
-- 1. reportes.carga_tarifa: una fila por ítem, ligada a la carga (se borra con ella).
-- 2. Views v_tarifas_garantizadas y v_tarifas_diferenciadas con los nombres de columna del Excel más id_carga (el
--    filtro bloqueado del dashboard de estado de pago), solo de las cargas vigentes.
-- 3. metabase_lector ve las views, no la tabla base (los privilegios por defecto de la 016 se la darían: se revoca).
-- Las cargas subidas antes quedan sin tarifas: volver a subir el EP (reemplazándolo) para tenerlas.
-- Aplicar en Aiven y en Azure, después de la 023 y ANTES de desplegar el Backend que guarda las tarifas (ese Backend
-- falla al confirmar una carga si la tabla no existe; el anterior sigue funcionando con esta migración).
-- schema.sql ya la incluye. Es idempotente.

BEGIN;

-- 1. Tabla
CREATE TABLE IF NOT EXISTS reportes.carga_tarifa (
    id_tarifa       SERIAL PRIMARY KEY,
    id_carga        INT NOT NULL REFERENCES reportes.carga(id_carga) ON DELETE CASCADE,
    tipo            VARCHAR(12) NOT NULL,   -- GARANTIZADA | DIFERENCIADA
    fila            INT NOT NULL,           -- fila en la hoja "EP #NN MLC"
    item            VARCHAR(10) NOT NULL,   -- "1.1", "2.3"...
    descripcion     VARCHAR(100) NOT NULL,  -- Cargador Frontal, Excavadora, Bulldozer
    unidad          VARCHAR(20),            -- "H.M."
    cantidad        NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(14,2),          -- columna "P. Unitario"
    total           NUMERIC(16,2),
    CONSTRAINT ck_carga_tarifa_tipo CHECK (tipo IN ('GARANTIZADA', 'DIFERENCIADA')),
    CONSTRAINT ux_carga_tarifa_fila UNIQUE (id_carga, fila)
);
COMMENT ON TABLE reportes.carga_tarifa IS 'Tablas "Tarifas garantizadas" y "Tarifas diferenciadas" de la hoja "EP #NN MLC" del EP';

-- 2. Views
CREATE OR REPLACE VIEW reportes.v_tarifas_garantizadas AS
SELECT t.item            AS "Item",
       t.descripcion     AS "Descripcion",
       t.unidad          AS "Unidad",
       t.cantidad        AS "Cantidad",
       t.precio_unitario AS "P. Unitario",
       t.total           AS "Total",
       c.id_carga
FROM reportes.carga_tarifa t
JOIN reportes.carga c ON c.id_carga = t.id_carga AND c.vigente
WHERE t.tipo = 'GARANTIZADA'
ORDER BY c.id_carga, t.fila; -- mismo orden que el Excel

CREATE OR REPLACE VIEW reportes.v_tarifas_diferenciadas AS
SELECT t.item            AS "Item",
       t.descripcion     AS "Descripcion",
       t.unidad          AS "Unidad",
       t.cantidad        AS "Cantidad",
       t.precio_unitario AS "P. Unitario",
       t.total           AS "Total",
       c.id_carga
FROM reportes.carga_tarifa t
JOIN reportes.carga c ON c.id_carga = t.id_carga AND c.vigente
WHERE t.tipo = 'DIFERENCIADA'
ORDER BY c.id_carga, t.fila;

-- 3. Metabase solo ve las views
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_lector') THEN
        REVOKE ALL ON reportes.carga_tarifa FROM metabase_lector;
        GRANT SELECT ON reportes.v_tarifas_garantizadas, reportes.v_tarifas_diferenciadas TO metabase_lector;
    END IF;
END $$;

COMMIT;

-- Verificación 1: lo que ve Metabase. Deben salir exactamente v_cargas, v_estados_app, v_horas_app, v_horas_excel,
-- v_horometros_excel, v_tarifas_diferenciadas y v_tarifas_garantizadas (sin carga_tarifa)
SELECT table_name
FROM information_schema.role_table_grants
WHERE grantee = 'metabase_lector' AND table_schema = 'reportes' AND privilege_type = 'SELECT'
ORDER BY table_name;

-- Verificación 2 (después de volver a subir el EP): tarifas por carga vigente. Con el EP #08: 4 garantizadas y 4
-- diferenciadas
SELECT c.id_carga, to_char(c.periodo, 'YYYY-MM') AS periodo, c.archivo,
       COUNT(*) FILTER (WHERE t.tipo = 'GARANTIZADA') AS garantizadas,
       COUNT(*) FILTER (WHERE t.tipo = 'DIFERENCIADA') AS diferenciadas,
       SUM(t.total) AS total
FROM reportes.carga c
LEFT JOIN reportes.carga_tarifa t ON t.id_carga = c.id_carga
WHERE c.vigente
GROUP BY c.id_carga, c.periodo, c.archivo
ORDER BY c.periodo;
