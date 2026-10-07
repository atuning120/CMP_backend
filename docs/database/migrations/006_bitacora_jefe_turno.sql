-- Bitácora de acciones del jefe de turno sobre la flota (incorporar, editar, habilitar, deshabilitar, reemplazar),
-- con el motivo y la observación que ingresa. Alimenta la pestaña Historial junto con los inicios de turno (tabla TURNO).
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya la incluye.

CREATE TABLE IF NOT EXISTS BITACORA_JEFE_TURNO (
    id_bitacora     SERIAL PRIMARY KEY,
    accion          VARCHAR(20) NOT NULL CHECK (accion IN ('INCORPORAR', 'EDITAR', 'HABILITAR', 'DESHABILITAR', 'REEMPLAZAR')),
    id_maquina      INT NOT NULL,
    id_usuario      INT NOT NULL, -- jefe de turno que realizó la acción (sale de la sesión)
    motivo          VARCHAR(100) NOT NULL,
    observacion     TEXT,
    detalle         JSONB, -- datos de la acción (p. ej. valores antes/después al editar)
    fecha           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bitacora_maquina FOREIGN KEY (id_maquina) REFERENCES MAQUINA(id_maquina),
    CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
);

-- El historial se lee siempre del más reciente al más antiguo
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON BITACORA_JEFE_TURNO (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_turno_hora_inicio ON TURNO (hora_inicio DESC);
