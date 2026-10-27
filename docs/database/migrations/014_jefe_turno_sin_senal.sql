-- Acciones del jefe de turno hechas sin señal en la app: se guardan en el teléfono y se envían al volver la red, con un
-- UUID generado en el teléfono que se repite en cada reintento. Con él, un reintento cuya primera respuesta no llegó
-- no se aplica dos veces:
-- - maquina.id_cliente: la incorporación (el reintento devuelve la máquina ya creada).
-- - bitacora_jefe_turno.id_cliente: la edición o cambio de estado (va en la primera fila que deja la acción).
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven). schema.sql ya lo incluye. Es idempotente.

ALTER TABLE maquina ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
ALTER TABLE bitacora_jefe_turno ADD COLUMN IF NOT EXISTS id_cliente UUID UNIQUE;
