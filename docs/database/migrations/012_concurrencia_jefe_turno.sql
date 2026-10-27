-- Concurrencia entre jefes de turno (web y app): una acción preparada sobre una versión vieja de la máquina no pisa
-- lo que otro cambió mientras tanto (responde 409 MAQUINA_MODIFICADA). Cada acción del jefe de turno sube la versión
-- y deja quién y cuándo. La atención de alertas suma id_cliente para que un reintento no la duplique.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE maquina ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE maquina ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ;
ALTER TABLE maquina ADD COLUMN IF NOT EXISTS actualizado_por INT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_maquina_actualizado_por') THEN
        ALTER TABLE maquina ADD CONSTRAINT fk_maquina_actualizado_por
            FOREIGN KEY (actualizado_por) REFERENCES usuario(id_usuario) ON DELETE SET NULL;
    END IF;
END $$;

-- Quién y cuándo, tomado de la última acción de la bitácora (solo en máquinas que aún no lo tienen)
UPDATE maquina m
SET actualizado_en = ultima.fecha, actualizado_por = ultima.id_usuario
FROM (
    SELECT DISTINCT ON (id_maquina) id_maquina, fecha, id_usuario
    FROM bitacora_jefe_turno
    ORDER BY id_maquina, fecha DESC, id_bitacora DESC
) ultima
WHERE ultima.id_maquina = m.id_maquina AND m.actualizado_en IS NULL;

ALTER TABLE atencion_alerta ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
