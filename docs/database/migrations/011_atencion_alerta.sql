-- Atención de las alertas de turno (turno o jornada de más de 10 h, cierre automático). Las alertas no se guardan:
-- se calculan desde TURNO y se identifican por 'E-<id_turno>', 'J-<id_turno>' o 'A-<id_turno>'. Aquí queda quién las
-- atendió, cuándo y con qué comentario. La primera fila de una alerta es su atención; las siguientes, notas agregadas
-- después (no se borran ni se editan: es un registro de auditoría).
-- La tabla ALERTA queda para las alertas que genere el GPS.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven). schema.sql ya lo incluye. Es idempotente.

CREATE TABLE IF NOT EXISTS ATENCION_ALERTA (
    id_atencion     SERIAL PRIMARY KEY,
    id_alerta       VARCHAR(20) NOT NULL, -- 'E-<id_turno>', 'J-<id_turno>' o 'A-<id_turno>'
    id_turno        INT NOT NULL,
    id_usuario      INT NOT NULL, -- jefe de turno o administrador que la atendió (sale de la sesión)
    comentario      TEXT,         -- opcional al atender; obligatorio en las notas posteriores
    fecha           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_atencion_alerta_id CHECK (id_alerta ~ '^[EJA]-[0-9]+$'),
    CONSTRAINT fk_atencion_turno FOREIGN KEY (id_turno) REFERENCES TURNO(id_turno) ON DELETE CASCADE,
    CONSTRAINT fk_atencion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_atencion_alerta_alerta ON ATENCION_ALERTA (id_alerta, fecha);
