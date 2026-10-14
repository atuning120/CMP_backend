-- Login web con Microsoft (Entra ID): los usuarios con correo de CMP, IMOPAC o la UCN que entran por
-- primera vez se registran solos como VISOR. Se agrega el proveedor 'MICROSOFT' y el identificador
-- inmutable de la cuenta en Entra ID (claim oid), que es más confiable que el correo para reconocerla.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya lo incluye.

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_proveedor_auth_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_proveedor_auth_check
    CHECK (proveedor_auth IN ('GOOGLE', 'CREDENCIALES', 'MICROSOFT'));

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS entra_oid VARCHAR(64) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_entra_oid ON usuario (entra_oid) WHERE entra_oid IS NOT NULL;
