-- Datos de registro de la máquina que el jefe de turno ingresa al incorporarla a planta desde la app.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya los incluye.

ALTER TABLE MAQUINA ADD COLUMN IF NOT EXISTS patente VARCHAR(15);
ALTER TABLE MAQUINA ADD COLUMN IF NOT EXISTS numero_chasis VARCHAR(50);
ALTER TABLE MAQUINA ADD COLUMN IF NOT EXISTS horometro_inicial NUMERIC(10,2);
ALTER TABLE MAQUINA ADD COLUMN IF NOT EXISTS es_contratista BOOLEAN NOT NULL DEFAULT FALSE;

-- El código interno (nombre) y la patente identifican a la máquina en faena: no se pueden repetir
CREATE UNIQUE INDEX IF NOT EXISTS ux_maquina_nombre ON MAQUINA (UPPER(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS ux_maquina_patente ON MAQUINA (UPPER(patente)) WHERE patente IS NOT NULL;
