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
    proveedor_auth  VARCHAR(30) NOT NULL CHECK (proveedor_auth IN ('GOOGLE', 'CREDENCIALES')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    id_operador     INT UNIQUE NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_operador FOREIGN KEY (id_operador) REFERENCES OPERADOR(id_operador) ON DELETE SET NULL
);

CREATE TABLE AREA (
    id_area         SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
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
    estado          VARCHAR(20) CHECK (estado IN ('ACTIVA', 'BAJA'))
);

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

CREATE TABLE TRACKING_HISTORY (
    id_history      BIGINT NOT NULL,
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
