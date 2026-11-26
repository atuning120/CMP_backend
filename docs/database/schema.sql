-- =============================================================================
-- Esquema de la base de datos CMP (PostgreSQL + PostGIS)
-- Fuente de verdad de tablas, columnas, restricciones y relaciones.
-- Resumen legible y diagrama ER: docs/database_schema.md
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE OPERADOR (
    id_operador     SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    rut             VARCHAR(12) NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    estado          VARCHAR(30)
);

CREATE TABLE USUARIO (
    id_usuario      SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),
    nombre          VARCHAR(100) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('VISOR', 'ADMIN','OPERADOR', 'JEFE_TURNO' )),
    proveedor_auth  VARCHAR(30) NOT NULL CONSTRAINT usuario_proveedor_auth_check CHECK (proveedor_auth IN ('GOOGLE', 'CREDENCIALES', 'MICROSOFT')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    id_operador     INT UNIQUE NULL,
    entra_oid       VARCHAR(64) NULL, -- id de la cuenta Microsoft (claim oid) si entra con Microsoft
    recorridos_vistos TEXT[] NOT NULL DEFAULT '{}', -- recorridos guiados del panel web ya hechos u omitidos (p. ej. 'web.visor.v1')
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_operador FOREIGN KEY (id_operador) REFERENCES OPERADOR(id_operador) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ux_usuario_entra_oid ON USUARIO (entra_oid) WHERE entra_oid IS NOT NULL;

CREATE TABLE AREA (
    id_area         SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    codigo          VARCHAR(4),
    icono           VARCHAR(30),
    orden           INT,
    poligono        GEOMETRY(Polygon, 4326),
    estado          VARCHAR(30),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_en   TIMESTAMPTZ,
    modificado_por  INT,
    CONSTRAINT fk_area_usuario FOREIGN KEY (modificado_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
);

CREATE TABLE ZONA_TRABAJO (
    id_zona         SERIAL PRIMARY KEY,
    id_area         INT NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    poligono        GEOMETRY(Polygon, 4326),
    estado          VARCHAR(30),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modificado_en   TIMESTAMPTZ,
    modificado_por  INT,
    CONSTRAINT fk_zona_area FOREIGN KEY (id_area) REFERENCES AREA(id_area) ON DELETE CASCADE,
    CONSTRAINT fk_zona_usuario FOREIGN KEY (modificado_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
);

CREATE TABLE AUDITORIA_GEOCERCA (
    id_auditoria      SERIAL PRIMARY KEY,
    entidad           VARCHAR(20) NOT NULL CHECK (entidad IN ('AREA', 'ZONA')),
    id_entidad         INT NOT NULL,
    accion            VARCHAR(20) NOT NULL CHECK (accion IN ('CREAR', 'EDITAR', 'DESACTIVAR')),
    poligono_anterior GEOMETRY(Polygon, 4326),
    id_usuario        INT NOT NULL,
    fecha             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE TABLE MAQUINA (
    id_maquina      SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    marca           VARCHAR(50),
    modelo          VARCHAR(50),
    anio            INT,
    tipo_maquina    VARCHAR(50),
    estado          VARCHAR(20) CHECK (estado IN ('ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'SIN_OPERADOR', 'BAJA')),
    patente           VARCHAR(15),
    numero_chasis     VARCHAR(50), -- N° de chasis / serie (VIN)
    horometro_inicial NUMERIC(10,2), -- al incorporarse a planta; luego manda el horómetro de los turnos
    es_contratista    BOOLEAN NOT NULL DEFAULT FALSE, -- equipo de contratista o arriendo
    codigo_ep         VARCHAR(50), -- equipo de contratista: "N° Interno" con que IMOPAC lo identifica en el EP
    regreso_estimado  TIMESTAMPTZ, -- en mantenimiento o fuera de servicio: cuándo se espera que vuelva a operar
    -- Tras un reemplazo: la máquina que la cubre y a qué estado vuelve ese respaldo al devolverla
    id_maquina_respaldo    INT,
    estado_previo_respaldo VARCHAR(20),
    -- Sube con cada acción del jefe de turno: detecta cambios de otro jefe mientras tanto (409 MAQUINA_MODIFICADA)
    version         INT NOT NULL DEFAULT 1,
    actualizado_en  TIMESTAMPTZ, -- última acción del jefe de turno sobre la máquina
    actualizado_por INT,
    id_cliente      UUID UNIQUE, -- generado por la app al incorporarla (sin señal): un reintento no la duplica
    CONSTRAINT fk_maquina_respaldo FOREIGN KEY (id_maquina_respaldo) REFERENCES MAQUINA(id_maquina) ON DELETE SET NULL,
    CONSTRAINT fk_maquina_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL,
    CONSTRAINT ck_maquina_estado_previo_respaldo
        CHECK (estado_previo_respaldo IN ('ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'SIN_OPERADOR', 'BAJA'))
);

-- El código interno (nombre) y la patente identifican a la máquina en faena: no se pueden repetir
CREATE UNIQUE INDEX ux_maquina_nombre ON MAQUINA (UPPER(nombre));
CREATE UNIQUE INDEX ux_maquina_patente ON MAQUINA (UPPER(patente)) WHERE patente IS NOT NULL;

-- Catálogo de modelos genéricos ("Datos Previos" al incorporar una máquina). Sin FKs: solo rellena el formulario.
CREATE TABLE MODELO_MAQUINA (
    id_modelo       SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL, -- nombre corto que se muestra en la app
    marca           VARCHAR(50) NOT NULL,
    modelo          VARCHAR(50) NOT NULL,
    tipo_maquina    VARCHAR(50) NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_modelo_maquina_marca_modelo ON MODELO_MAQUINA (UPPER(marca), UPPER(modelo));

CREATE TABLE DISPOSITIVO_GPS (
    id_gps          SERIAL PRIMARY KEY,
    imei            VARCHAR(50) NOT NULL UNIQUE,
    modelo          VARCHAR(50),
    numero_sim      VARCHAR(30),
    estado          VARCHAR(30)
);

CREATE TABLE ESTADO_OPERACIONAL (
    id_estado       SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    categoria       VARCHAR(30) CHECK (categoria IN ('PRODUCTIVO', 'DEMORA', 'MANTENCION')),
    es_productivo   BOOLEAN NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion     TEXT -- qué significa el estado; la app la muestra en el botón "i"
);

CREATE TABLE ASIGNACION_GPS (
    id_asignacion   SERIAL PRIMARY KEY,
    id_gps          INT NOT NULL,
    id_maquina      INT NOT NULL,
    vigente_desde   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vigente_hasta   TIMESTAMPTZ NULL, -- null si esta vigente
    CONSTRAINT fk_asig_gps FOREIGN KEY (id_gps) REFERENCES DISPOSITIVO_GPS(id_gps),
    CONSTRAINT fk_asig_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina)
);

-- Operador a cargo de cada máquina (el que la tiene preseleccionada al iniciar turno).
-- Guarda el historial: al cambiar de operador la asignación anterior se cierra con vigente_hasta
CREATE TABLE ASIGNACION_OPERADOR (
    id_asignacion   SERIAL PRIMARY KEY,
    id_maquina      INT NOT NULL,
    id_operador     INT NOT NULL,
    vigente_desde   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vigente_hasta   TIMESTAMPTZ NULL, -- null si está vigente
    CONSTRAINT fk_asig_op_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina),
    CONSTRAINT fk_asig_op_operador FOREIGN KEY (id_operador) REFERENCES OPERADOR(id_operador)
);

-- A lo más un operador vigente por máquina y una máquina vigente por operador
CREATE UNIQUE INDEX ux_asig_op_maquina_vigente ON ASIGNACION_OPERADOR (id_maquina) WHERE vigente_hasta IS NULL;
CREATE UNIQUE INDEX ux_asig_op_operador_vigente ON ASIGNACION_OPERADOR (id_operador) WHERE vigente_hasta IS NULL;

CREATE SEQUENCE tracking_history_id_history_seq;

-- Posiciones GPS que envía el adaptador (POST /tracking/posiciones)
CREATE TABLE TRACKING_HISTORY (
    id_history      BIGINT NOT NULL DEFAULT nextval('tracking_history_id_history_seq'),
    timestamp       TIMESTAMPTZ NOT NULL,
    id_gps          INT NOT NULL,
    id_maquina      INT NOT NULL, -- copiado al ingerir
    ubicacion       GEOMETRY(Point, 4326),
    velocidad       NUMERIC(6,2),
    heading         NUMERIC(6,2),
    nivel_bateria   NUMERIC(5,2),
    payload_crudo   JSONB,
    PRIMARY KEY (id_history, timestamp),
    CONSTRAINT fk_tracking_gps FOREIGN KEY (id_gps) REFERENCES DISPOSITIVO_GPS(id_gps),
    CONSTRAINT fk_tracking_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina)
);

ALTER SEQUENCE tracking_history_id_history_seq OWNED BY TRACKING_HISTORY.id_history;
-- Una posición reenviada (mismo dispositivo y fecha) no se duplica
CREATE UNIQUE INDEX ux_tracking_history_gps_timestamp ON TRACKING_HISTORY (id_gps, timestamp);
-- Última posición de cada máquina
CREATE INDEX ix_tracking_history_maquina_timestamp ON TRACKING_HISTORY (id_maquina, timestamp DESC);
CREATE INDEX ix_asignacion_gps_gps ON ASIGNACION_GPS (id_gps);
CREATE INDEX ix_asignacion_gps_maquina ON ASIGNACION_GPS (id_maquina);
-- Un GPS está en una sola máquina a la vez
CREATE UNIQUE INDEX ux_asignacion_gps_vigente ON ASIGNACION_GPS (id_gps) WHERE vigente_hasta IS NULL;

CREATE TABLE ALERTA (
    id_alerta       SERIAL PRIMARY KEY,
    id_gps          INT NOT NULL,
    id_maquina      INT NOT NULL,
    tipo            VARCHAR(50) NOT NULL,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detalle         TEXT,
    atendida        BOOLEAN DEFAULT FALSE,
    atendida_por    INT NULL,
    atendida_en     TIMESTAMPTZ NULL,
    CONSTRAINT fk_alerta_gps FOREIGN KEY (id_gps) REFERENCES DISPOSITIVO_GPS(id_gps),
    CONSTRAINT fk_alerta_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina),
    CONSTRAINT fk_alerta_usuario FOREIGN KEY (atendida_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
);

CREATE TABLE TURNO (
    id_turno          SERIAL PRIMARY KEY,
    id_operador       INT NOT NULL,
    id_maquina        INT NOT NULL,
    fecha_turno       DATE NOT NULL, -- fecha de inicio
    hora_inicio       TIMESTAMPTZ NOT NULL,
    hora_termino      TIMESTAMPTZ NULL,
    horometro_inicial NUMERIC(10,2) NOT NULL,
    horometro_final   NUMERIC(10,2) NULL,
    estado            VARCHAR(20) CHECK (estado IN ('EN_CURSO', 'CERRADO', 'CERRADO_AUTO')),
    id_cliente        UUID UNIQUE, -- generado en el teléfono; hace idempotente la sincronización offline
    conflicto         BOOLEAN NOT NULL DEFAULT FALSE, -- aceptado pese a chocar con otro turno; revisar
    conflicto_detalle TEXT,
    cerrado_por       INT, -- jefe de turno que lo cerró por el operador
    motivo_cierre     VARCHAR(100),
    id_cliente_cierre UUID UNIQUE, -- cierre del jefe de turno desde la app (sin señal): un reintento no lo repite
    horometro_regularizado_por INT, -- jefe de turno que informó el horómetro final de un cierre automático
    CONSTRAINT fk_turno_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_turno_horometro_regularizado_por FOREIGN KEY (horometro_regularizado_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_turno_operador FOREIGN KEY (id_operador) REFERENCES OPERADOR(id_operador),
    CONSTRAINT fk_turno_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina)
);

CREATE TABLE TURNO_UBICACION (
    id_turno_ubicacion SERIAL PRIMARY KEY,
    id_turno           INT NOT NULL,
    id_area            INT NOT NULL,
    id_zona            INT NULL, -- nullable
    inicio             TIMESTAMPTZ NOT NULL,
    fin                TIMESTAMPTZ NULL, -- null si vigente
    id_cliente         UUID UNIQUE, -- cambio registrado desde la app; NULL en la ubicación inicial del turno
    CONSTRAINT fk_tubicacion_turno FOREIGN KEY (id_turno) REFERENCES TURNO(id_turno) ON DELETE CASCADE,
    CONSTRAINT fk_tubicacion_area FOREIGN KEY (id_area) REFERENCES AREA(id_area),
    CONSTRAINT fk_tubicacion_zona FOREIGN KEY (id_zona) REFERENCES ZONA_TRABAJO(id_zona) ON DELETE SET NULL
);

CREATE TABLE TURNO_ESTADO (
    id_turno_estado SERIAL PRIMARY KEY,
    id_turno        INT NOT NULL,
    id_estado       INT NOT NULL,
    inicio          TIMESTAMPTZ NOT NULL,
    fin             TIMESTAMPTZ NULL, -- null si vigente
    comentario      TEXT,
    id_cliente      UUID UNIQUE,
    CONSTRAINT fk_testado_turno FOREIGN KEY (id_turno) REFERENCES TURNO(id_turno) ON DELETE CASCADE,
    CONSTRAINT fk_testado_estado FOREIGN KEY (id_estado) REFERENCES ESTADO_OPERACIONAL(id_estado)
);

-- Alertas de mantención o falla por rango de fechas
CREATE INDEX idx_turno_estado_inicio ON TURNO_ESTADO (inicio);

CREATE TABLE REPORTE_TURNO (
    id_reporte            SERIAL PRIMARY KEY,
    id_turno              INT NOT NULL,
    tipo                  VARCHAR(10) CHECK (tipo IN ('INICIO', 'FIN', 'NOVEDAD')),
    descripcion           TEXT,
    fecha_hora            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_sincronizacion VARCHAR(30),
    id_cliente            UUID UNIQUE,
    CONSTRAINT fk_reporte_turno FOREIGN KEY (id_turno) REFERENCES TURNO(id_turno) ON DELETE CASCADE
);

CREATE TABLE EVIDENCIA (
    id_evidencia          SERIAL PRIMARY KEY,
    id_reporte            INT NOT NULL,
    url_blob              TEXT NOT NULL,
    fecha_hora            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado_sincronizacion VARCHAR(30),
    id_cliente            UUID UNIQUE,
    CONSTRAINT fk_evidencia_reporte FOREIGN KEY (id_reporte) REFERENCES REPORTE_TURNO(id_reporte) ON DELETE CASCADE
);

-- Acciones del jefe de turno sobre la flota, con motivo y observación (pestaña Historial junto con TURNO)
CREATE TABLE BITACORA_JEFE_TURNO (
    id_bitacora     SERIAL PRIMARY KEY,
    accion          VARCHAR(20) NOT NULL CONSTRAINT bitacora_jefe_turno_accion_check
                    CHECK (accion IN ('INCORPORAR', 'EDITAR', 'HABILITAR', 'DESHABILITAR', 'CAMBIAR_ESTADO', 'REEMPLAZAR', 'DEVOLVER', 'REGULARIZAR')),
    id_maquina      INT NOT NULL,
    id_usuario      INT NOT NULL, -- jefe de turno que realizó la acción (sale de la sesión)
    motivo          VARCHAR(100) NOT NULL,
    observacion     TEXT,
    detalle         JSONB, -- datos de la acción (p. ej. valores antes/después al editar)
    fecha           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_cliente      UUID UNIQUE, -- generado por la app (acción sin señal): un reintento no la aplica dos veces
    CONSTRAINT fk_bitacora_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina),
    CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE INDEX idx_bitacora_fecha ON BITACORA_JEFE_TURNO (fecha DESC);

-- Atención de las alertas de turno (que se calculan desde TURNO, no se guardan). La primera fila de una alerta es su
-- atención; las siguientes, notas posteriores. No se borran ni se editan (auditoría)
CREATE TABLE ATENCION_ALERTA (
    id_atencion     SERIAL PRIMARY KEY,
    id_alerta       VARCHAR(20) NOT NULL, -- 'E-<id_turno>', 'J-<id_turno>', 'A-<id_turno>' o 'M-<id_turno_estado>'
    id_turno        INT NOT NULL,
    id_usuario      INT NOT NULL, -- jefe de turno o administrador que la atendió
    comentario      TEXT,         -- opcional al atender; obligatorio en las notas posteriores
    fecha           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_cliente      UUID UNIQUE,  -- generado por el cliente; hace idempotente el reintento
    CONSTRAINT ck_atencion_alerta_id CHECK (id_alerta ~ '^[EJAM]-[0-9]+$'),
    CONSTRAINT fk_atencion_turno FOREIGN KEY (id_turno) REFERENCES TURNO(id_turno) ON DELETE CASCADE,
    CONSTRAINT fk_atencion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE INDEX idx_atencion_alerta_alerta ON ATENCION_ALERTA (id_alerta, fecha);
CREATE INDEX idx_turno_hora_inicio ON TURNO (hora_inicio DESC);

CREATE TABLE REFRESH_TOKEN (
    id_refresh_token  SERIAL PRIMARY KEY,
    id_usuario        INT NOT NULL,
    token_hash        CHAR(64) NOT NULL UNIQUE, -- SHA-256 (hex) del token; el token en claro solo lo tiene el dispositivo
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en         TIMESTAMPTZ NOT NULL,
    revocado_en       TIMESTAMPTZ NULL, -- null si vigente
    CONSTRAINT fk_refresh_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_token_usuario ON REFRESH_TOKEN(id_usuario);

-- Historial de versiones de la app móvil para la página pública de descarga (migración 023). Archivos en el
-- contenedor privado "apk" de Azure Blob Storage
CREATE TABLE VERSION_APP (
    id_version_app  SERIAL PRIMARY KEY,
    version         VARCHAR(20) NOT NULL UNIQUE CHECK (version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'), -- "1.4.0", el version de app.json
    notas           TEXT NOT NULL DEFAULT '', -- novedades de la versión, se muestran en la página pública
    archivo         VARCHAR(200) NOT NULL UNIQUE, -- nombre del blob en el contenedor "apk"
    tamano_bytes    BIGINT NOT NULL CHECK (tamano_bytes > 0),
    publicada       BOOLEAN NOT NULL DEFAULT TRUE, -- false: retirada
    subida_por      INT NULL,
    subida_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_version_app_usuario FOREIGN KEY (subida_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
);

-- Reportes para Metabase (migraciones 016, 017, 020 a 022, 024 y 028): carga mensual del Excel del EP del contratista y views que
-- leen los dashboards. Los usuarios de Postgres de Metabase (metabase_app, metabase_lector) se crean con la migración
-- 016, no aquí; la 021 deja a metabase_lector viendo solo las views.
-- 1. Schema `reportes`: todo lo que lee Metabase vive aquí. Su usuario solo ve este schema, nunca las tablas de la app
--    (OPERADOR, USUARIO, etc.): las views de abajo leen la app con los permisos de su dueño.
-- 2. Cargas del Excel: una por período EP (el EP de junio cubre p. ej. del 25-05 al 25-06), solo una vigente por mes.
--    Del Excel se guarda la hoja "Base de datos" (horas por equipo) y, de la hoja "EP #NN MLC", solo las tablas
--    "Tarifas garantizadas" y "Tarifas diferenciadas"; las hojas con personas y el resto de los montos nunca llegan a
--    la base.
-- 3. Views: la app en vivo (dashboard de operación), el Excel por sí solo (dashboard de estado de pago) y el cruce de
--    los dos (dashboard de comparación).
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
    equipo            VARCHAR(50) NOT NULL, -- columna "N° Interno": código interno (MAQUINA.nombre)
    categoria         VARCHAR(50),          -- columna "Equipo": Bulldozer, Cargador Frontal...
    codigo_report     VARCHAR(30),
    fecha             DATE NOT NULL,
    hora_inicio       TIME,
    horometro_inicial NUMERIC(10,2),
    horometro_final   NUMERIC(10,2),
    horas             NUMERIC(10,2) NOT NULL, -- columna "Diferencia"
    area              VARCHAR(100),         -- columna "Area", tal como la escribe el contratista: "Area 84", "Tacho"...
    id_excel          INT                   -- columna "ID"
);
CREATE INDEX IF NOT EXISTS ix_carga_registro_carga ON reportes.carga_registro (id_carga, equipo, fecha);

-- Tablas "Tarifas garantizadas" (ítems 1.x) y "Tarifas diferenciadas" (ítems 2.x) de la hoja "EP #NN MLC" (el número
-- cambia con cada EP)
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

-- 3. Views
-- Horas de la app en vivo: una fila por turno cerrado y área (las horas se reparten según el tiempo en cada área;
-- sumar `horas`, no los horómetros). jornada = día del EP: en el Excel la jornada D empieza con el turno de noche
-- de la tarde del día D-1, así que un turno que empieza a las 12:00 o después cuenta para el día siguiente
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

-- Tiempo en cada estado operacional (productivo, demora, mantención) en vivo
CREATE OR REPLACE VIEW reportes.v_estados_app AS
SELECT te.id_turno_estado,
       t.id_turno,
       t.id_maquina,
       m.nombre AS equipo,
       m.tipo_maquina AS categoria,
       t.fecha_turno AS fecha,
       regexp_replace(eo.nombre, '^[^/]+/\s*', '')::VARCHAR(100) AS estado, -- sin "Demora / ": ya está en categoria_estado (020)
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

-- Filas del Excel de las cargas vigentes con la misma estructura que la hoja "Base de datos" del EP (mismos nombres y
-- orden de columnas), más "Horas Dia" y "Horas Noche" (la Diferencia repartida por reloj desde la hora de inicio, día de
-- 08:00 a 20:00) e id_carga (filtro bloqueado del dashboard).
-- En SQL los nombres van entre comillas dobles: "N° Interno"
CREATE OR REPLACE VIEW reportes.v_horas_excel AS
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
CREATE OR REPLACE VIEW reportes.v_horometros_excel AS
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

-- Tarifas de las cargas vigentes con los nombres de columna del Excel, más id_carga (filtro bloqueado del dashboard)
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
ORDER BY c.id_carga, t.fila;

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

-- Excel del EP contra la app por equipo y jornada (dashboard de comparación, migración 028): ver ahí las reglas del cruce
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
