-- Sesiones de la app móvil: refresh tokens para renovar el access token sin pedir la contraseña.
-- Aplicar una vez en bases creadas antes de este cambio (p. ej. Aiven). schema.sql ya la incluye.
CREATE TABLE IF NOT EXISTS REFRESH_TOKEN (
    id_refresh_token  SERIAL PRIMARY KEY,
    id_usuario        INT NOT NULL,
    token_hash        CHAR(64) NOT NULL UNIQUE, -- SHA-256 (hex) del token; el token en claro solo lo tiene el dispositivo
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en         TIMESTAMPTZ NOT NULL,
    revocado_en       TIMESTAMPTZ NULL, -- null si vigente
    CONSTRAINT fk_refresh_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_usuario ON REFRESH_TOKEN(id_usuario);
