-- Recorrido guiado del panel web: la primera vez que un usuario entra se le ofrece un tour de las funciones de su rol
-- (puede hacerlo u omitirlo). Aquí quedan los recorridos que ya hizo u omitió, p. ej. '{web.visor.v1}': vacío = primer
-- ingreso. Es una lista y no un booleano porque cada rol tiene su recorrido (si un VISOR pasa a JEFE_TURNO ve el nuevo)
-- y porque una versión nueva de un recorrido ('web.visor.v2') se vuelve a mostrar a todos.
-- Aplicar una vez en Azure y Aiven. schema.sql ya lo incluye. Es idempotente.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS recorridos_vistos TEXT[] NOT NULL DEFAULT '{}';

-- Comprobación: debe devolver una fila con data_type ARRAY y default '{}'::text[]
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'usuario' AND column_name = 'recorridos_vistos';
