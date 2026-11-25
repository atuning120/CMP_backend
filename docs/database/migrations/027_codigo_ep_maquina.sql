-- Código EP de un equipo de contratista: con el que IMOPAC lo identifica en el estado de pago mensual (columna
-- "N° Interno" del Excel), distinto del código interno de la máquina. Opcional; solo en equipos de contratista.
-- Aplicar una vez en bases creadas antes de este cambio (Azure y Aiven), ANTES de desplegar el Backend. schema.sql ya
-- lo incluye. Es idempotente.

ALTER TABLE maquina ADD COLUMN IF NOT EXISTS codigo_ep VARCHAR(50);
