-- Historial de versiones de la app móvil (APK de Android) para la página pública de descarga del panel web.
-- El ADMIN publica cada versión desde el panel: el archivo va al contenedor privado "apk" de Azure Blob Storage y aquí
-- queda su número, notas, tamaño y quién la subió. "publicada = false" = retirada (no se muestra ni se descarga).
-- Aplicar en Aiven y en Azure antes de desplegar el Backend que la usa. schema.sql ya la incluye. Es idempotente.

CREATE TABLE IF NOT EXISTS VERSION_APP (
    id_version_app  SERIAL PRIMARY KEY,
    version         VARCHAR(20) NOT NULL UNIQUE CHECK (version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'), -- "1.4.0", el version de app.json
    notas           TEXT NOT NULL DEFAULT '', -- novedades de la versión, se muestran en la página pública
    archivo         VARCHAR(200) NOT NULL UNIQUE, -- nombre del blob en el contenedor "apk"
    tamano_bytes    BIGINT NOT NULL CHECK (tamano_bytes > 0),
    publicada       BOOLEAN NOT NULL DEFAULT TRUE, -- false: retirada
    subida_por      INT NULL,
    subida_en       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_version_app_usuario FOREIGN KEY (subida_por) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
);
