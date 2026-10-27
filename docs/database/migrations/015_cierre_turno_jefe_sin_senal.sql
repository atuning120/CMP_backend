-- Cierre de turno por el jefe de turno hecho sin señal en la app: se envía al volver la red con un UUID generado en el
-- teléfono, el mismo en cada reintento. Con él, un reintento cuya primera respuesta no llegó responde con el cierre ya
-- guardado en vez de informar que "otro" lo cerró.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE turno ADD COLUMN IF NOT EXISTS id_cliente_cierre UUID UNIQUE;
