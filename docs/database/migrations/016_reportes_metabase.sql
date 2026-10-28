-- Dashboards de Metabase (embebidos en la web) y carga mensual del Excel del estado de pago (EP) del contratista.
-- 1. Schema `reportes`: todo lo que lee Metabase vive aquí. Su usuario solo ve este schema, nunca las tablas de la app
--    (OPERADOR, USUARIO, etc.): las views de abajo leen la app con los permisos de su dueño.
-- 2. Cargas del Excel: una por período EP (el EP de junio cubre p. ej. del 25-05 al 25-06), solo una vigente por mes.
--    Del Excel se guarda únicamente la hoja "Base de datos" (horas por equipo); las hojas con personas, tarifas y
--    montos nunca llegan a la base.
-- 3. Al confirmar una carga, el Backend congela las horas de la app de ese rango (CARGA_HORAS_APP): el dashboard de un
--    EP pasado no cambia aunque después lleguen turnos sincronizados sin señal.
-- 4. Views con las mismas columnas para App y Excel, más la comparación por equipo y día.
-- 5. Usuarios de Postgres para Metabase: `metabase_app` (dueño de la base interna `metabase`, donde guarda sus
--    dashboards) y `metabase_lector` (solo lectura del schema `reportes`). Se crean SIN contraseña: asignarla a mano
--    en pgAdmin con ALTER ROLE ... PASSWORD, nunca en este archivo.
-- Aplicar una vez en Azure y Aiven. schema.sql ya incluye 1 a 4. Es idempotente.

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS reportes;

-- 2. Cargas del Excel
CREATE TABLE IF NOT EXISTS reportes.carga (
    id_carga        SERIAL PRIMARY KEY,
    periodo         DATE NOT NULL,          -- mes del EP (primer día del mes)
    fecha_desde     DATE NOT NULL,          -- rango que cubre el EP
    fecha_hasta     DATE NOT NULL,
    archivo         VARCHAR(255) NOT NULL,  -- solo el nombre: el archivo original no se guarda (tiene datos personales)
    hash_sha256     CHAR(64) NOT NULL,
    filas           INT NOT NULL,
    vigente         BOOLEAN NOT NULL DEFAULT TRUE, -- false si otra carga la reemplazó
    subido_por      INT NOT NULL REFERENCES public.usuario(id_usuario),
    subido_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_carga_periodo CHECK (periodo = date_trunc('month', periodo)::date),
    CONSTRAINT ck_carga_rango CHECK (fecha_hasta >= fecha_desde)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carga_periodo_vigente ON reportes.carga (periodo) WHERE vigente;

-- Filas de la hoja "Base de datos"
CREATE TABLE IF NOT EXISTS reportes.carga_registro (
    id_registro       SERIAL PRIMARY KEY,
    id_carga          INT NOT NULL REFERENCES reportes.carga(id_carga) ON DELETE CASCADE,
    fila              INT NOT NULL,         -- fila en el Excel, para rastrear un dato raro hasta el archivo
    equipo            VARCHAR(50) NOT NULL, -- código interno (MAQUINA.nombre)
    categoria         VARCHAR(50),
    codigo_report     VARCHAR(30),
    fecha             DATE NOT NULL,
    hora_inicio       TIME,
    horometro_inicial NUMERIC(10,2),
    horometro_final   NUMERIC(10,2),
    horas             NUMERIC(10,2) NOT NULL, -- columna "Diferencia"
    actividad         VARCHAR(100)          -- "Area 84", "Tacho", ...
);
CREATE INDEX IF NOT EXISTS ix_carga_registro_carga ON reportes.carga_registro (id_carga, equipo, fecha);

-- Textos de "Actividad" que no se resuelven solos ("Tacho", "Pila Primaria"...). "Area NN" se cruza sin esto
CREATE TABLE IF NOT EXISTS reportes.equivalencia_area (
    texto       VARCHAR(100) PRIMARY KEY, -- en minúsculas y sin espacios en los extremos
    id_area     INT REFERENCES public.area(id_area) ON DELETE SET NULL,
    comentario  TEXT
);

-- 3. Horas de la app congeladas al confirmar la carga (mismas columnas que v_horas_app)
CREATE TABLE IF NOT EXISTS reportes.carga_horas_app (
    id_carga          INT NOT NULL REFERENCES reportes.carga(id_carga) ON DELETE CASCADE,
    id_turno          INT NOT NULL,
    id_maquina        INT NOT NULL,
    equipo            VARCHAR(100) NOT NULL,
    categoria         VARCHAR(50),
    fecha             DATE NOT NULL,
    hora_inicio       TIME,
    horometro_inicial NUMERIC(10,2),
    horometro_final   NUMERIC(10,2),
    horas             NUMERIC(10,2) NOT NULL,
    id_area           INT,
    area              VARCHAR(100),
    conflicto         BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_carga_horas_app_carga ON reportes.carga_horas_app (id_carga, equipo, fecha);

-- 4. Views
-- Horas de la app en vivo: una fila por turno cerrado y área. Si el turno pasó por varias áreas, sus horas de
-- horómetro se reparten según el tiempo en cada una (sumar `horas`, no los horómetros, que se repiten por área)
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
       tu.conflicto
FROM turnos tu
JOIN public.maquina m ON m.id_maquina = tu.id_maquina
LEFT JOIN reparto r ON r.id_turno = tu.id_turno
LEFT JOIN public.area a ON a.id_area = r.id_area;

-- Tiempo en cada estado operacional (productivo, demora, mantención) en vivo
CREATE OR REPLACE VIEW reportes.v_estados_app AS
SELECT te.id_turno_estado,
       t.id_turno,
       t.id_maquina,
       m.nombre AS equipo,
       m.tipo_maquina AS categoria,
       t.fecha_turno AS fecha,
       eo.nombre AS estado,
       eo.categoria AS categoria_estado,
       eo.es_productivo,
       te.inicio,
       COALESCE(te.fin, t.hora_termino) AS fin,
       ROUND((EXTRACT(EPOCH FROM COALESCE(te.fin, t.hora_termino, CURRENT_TIMESTAMP) - te.inicio) / 3600)::numeric, 2) AS horas
FROM public.turno_estado te
JOIN public.turno t ON t.id_turno = te.id_turno
JOIN public.maquina m ON m.id_maquina = t.id_maquina
JOIN public.estado_operacional eo ON eo.id_estado = te.id_estado;

-- Cargas vigentes, con una etiqueta para el filtro de período del dashboard
CREATE OR REPLACE VIEW reportes.v_cargas AS
SELECT c.id_carga,
       c.periodo,
       c.fecha_desde,
       c.fecha_hasta,
       'EP ' || to_char(c.periodo, 'YYYY-MM') || ' (' || to_char(c.fecha_desde, 'DD-MM') || ' al '
             || to_char(c.fecha_hasta, 'DD-MM') || ')' AS etiqueta,
       c.archivo,
       c.filas,
       c.subido_en
FROM reportes.carga c
WHERE c.vigente;

-- Horas del Excel de las cargas vigentes. El área sale de equivalencia_area o, si dice "Area NN", del área con ese
-- código (o con ese número en el nombre)
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
       a.nombre AS area
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

-- Horas de la app congeladas de las cargas vigentes (el lado "App" del dashboard del EP)
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
       s.conflicto
FROM reportes.carga_horas_app s
JOIN reportes.carga c ON c.id_carga = s.id_carga AND c.vigente;

-- Excel contra App por equipo y día. Estado: COINCIDE (diferencia de hasta 0,5 h), DIFIERE, SOLO_EXCEL, SOLO_APP
CREATE OR REPLACE VIEW reportes.v_comparacion AS
WITH excel AS (
    SELECT id_carga, UPPER(equipo) AS equipo, MAX(categoria) AS categoria, fecha,
           SUM(horas) AS horas, COUNT(*) AS registros
    FROM reportes.v_horas_excel
    GROUP BY id_carga, UPPER(equipo), fecha
), app AS (
    SELECT id_carga, UPPER(equipo) AS equipo, MAX(categoria) AS categoria, fecha,
           SUM(horas) AS horas, COUNT(DISTINCT id_turno) AS turnos
    FROM reportes.v_horas_app_ep
    GROUP BY id_carga, UPPER(equipo), fecha
)
SELECT c.id_carga,
       c.periodo,
       COALESCE(e.equipo, a.equipo) AS equipo,
       COALESCE(e.categoria, a.categoria) AS categoria,
       COALESCE(e.fecha, a.fecha) AS fecha,
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
FULL JOIN app a ON a.id_carga = e.id_carga AND a.equipo = e.equipo AND a.fecha = e.fecha
JOIN reportes.carga c ON c.id_carga = COALESCE(e.id_carga, a.id_carga);

-- Horómetros del Excel que no cuadran: el registro empieza en otro valor que donde terminó el anterior del mismo
-- equipo, o termina antes de empezar
CREATE OR REPLACE VIEW reportes.v_horometros_excel AS
SELECT *
FROM (
    SELECT id_carga, periodo, id_registro, fila, equipo, categoria, fecha, hora_inicio,
           horometro_inicial, horometro_final,
           LAG(horometro_final) OVER (PARTITION BY id_carga, UPPER(equipo) ORDER BY fecha, hora_inicio, fila)
               AS horometro_final_anterior,
           horometro_inicial - LAG(horometro_final) OVER (PARTITION BY id_carga, UPPER(equipo)
                                                           ORDER BY fecha, hora_inicio, fila) AS salto
    FROM reportes.v_horas_excel
) h
WHERE salto <> 0 OR horometro_final < horometro_inicial;

-- 5. Usuarios de Metabase (sin contraseña; ver arriba)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_app') THEN
        CREATE ROLE metabase_app LOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_lector') THEN
        CREATE ROLE metabase_lector LOGIN;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO metabase_lector', current_database());
END $$;

GRANT USAGE ON SCHEMA reportes TO metabase_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA reportes TO metabase_lector;
ALTER DEFAULT PRIVILEGES IN SCHEMA reportes GRANT SELECT ON TABLES TO metabase_lector;
