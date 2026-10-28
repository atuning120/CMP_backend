# Metabase (dashboards embebidos en la web)

Metabase OSS corre como Container App aparte (`cmp-metabase`, en `cmp-env`) con la imagen oficial: no hay repo ni
Dockerfile propio. Los dashboards los diseña el equipo en la interfaz de Metabase; la web los muestra en un `<iframe>`
con un token firmado por el Backend (static embedding), así que quien los ve no necesita cuenta en Metabase.

- Datos: Metabase lee **solo** el schema `reportes` de `cmp_db` con el usuario `metabase_lector` (ver
  [`database_schema.md`](database_schema.md#reportes-schema-reportes-dashboards-de-metabase)).
- Configuración de Metabase (dashboards, preguntas, usuarios): en la base `metabase` del mismo servidor
  `cmp-postgres`, dueña `metabase_app`. Queda dentro de los backups automáticos del servidor. Nunca usar el H2 por
  defecto: el disco del container se borra en cada reinicio.

## 1. Postgres (pgAdmin, servidor `cmp-postgres`)

1. Conectado a `cmp_db`, ejecutar [`migrations/016_reportes_metabase.sql`](database/migrations/016_reportes_metabase.sql).
   Crea el schema `reportes` y los usuarios `metabase_app` y `metabase_lector` sin contraseña.
2. Asignar contraseñas (generarlas largas y guardarlas en un gestor; no van en ningún archivo del repo):

   ```sql
   ALTER ROLE metabase_app PASSWORD '<contraseña-1>';
   ALTER ROLE metabase_lector PASSWORD '<contraseña-2>';
   ```

3. Crear la base interna. `CREATE DATABASE` no puede ir junto a otras sentencias: ejecutarlo **solo**:

   ```sql
   CREATE DATABASE metabase;
   ```

4. Dársela a `metabase_app`, con el Query Tool abierto sobre la base **`metabase`** (en Azure el schema `public` de una
   base nueva queda a nombre de quien la creó; sin esto Metabase falla con `permission denied for schema public`):

   ```sql
   GRANT metabase_app TO CURRENT_USER;
   ALTER DATABASE metabase OWNER TO metabase_app;
   ALTER SCHEMA public OWNER TO metabase_app;
   GRANT ALL ON SCHEMA public TO metabase_app;
   ```

5. Metabase usa la extensión `citext`, que Azure bloquea por defecto: en el portal, `cmp-postgres` → **Server
   parameters** → `azure.extensions`, marcar `CITEXT` (sin desmarcar `POSTGIS`) y guardar. Luego, sobre la base
   `metabase`:

   ```sql
   CREATE EXTENSION IF NOT EXISTS citext;
   ```

   Sin esto el arranque falla con `extension "citext" is not allow-listed`. Si una migración quedó a medias
   (`Waiting for changelog lock`), liberar el bloqueo sobre la base `metabase`:
   `UPDATE databasechangeloglock SET locked = FALSE, lockgranted = NULL, lockedby = NULL WHERE id = 1;`

El firewall de `cmp-postgres` ya permite servicios de Azure, así que la Container App se conecta sin cambios.

## 2. Imagen

Usar un tag fijo de [`metabase/metabase`](https://hub.docker.com/r/metabase/metabase/tags) (la última versión estable,
sin `-beta`), nunca `latest`. Primero probar la imagen directo desde Docker Hub. Si el entorno Express la rechaza
(media types Docker v2) o Docker Hub limita las descargas, copiarla una vez al ACR en formato OCI:

```bash
echo 'FROM metabase/metabase:<versión>' > /tmp/Dockerfile.metabase
docker buildx build -f /tmp/Dockerfile.metabase \
  --output type=image,name=cmpcapstoneacr.azurecr.io/metabase:<versión>,push=true,oci-mediatypes=true .
```

Actualizar Metabase = cambiar el tag en la Container App (Metabase migra su base interna solo al arrancar).

## 3. Container App `cmp-metabase`

| Campo | Valor |
|---|---|
| Grupo de recursos / región / entorno | `CMP_Capstone` / Chile Central / `cmp-env` |
| Imagen | `metabase/metabase:<versión>` (o la copia en `cmpcapstoneacr`) |
| CPU / memoria | 1 vCPU / 2 GiB (con menos, Java anda mal) |
| Ingress | habilitado, externo (el iframe lo carga el navegador), puerto de destino `3000` |
| Réplicas | mín. 0 (el primer acceso tarda 1–2 min en arrancar) o 1 (siempre rápido, cuesta más); máx. 1 |
| Health probe (si el portal lo permite) | `GET /api/health`, con margen de arranque de ~3 min |

Secrets: `mb-db-pass` (contraseña de `metabase_app`), `mb-encryption-key` (string aleatorio largo; cifra las
credenciales que Metabase guarda; si se pierde hay que volver a ingresar la contraseña de la conexión a `cmp_db`) y
`mb-session-key` (string aleatorio; firma las sesiones; cambiarlo cierra todas las sesiones).

| Variable | Valor |
|---|---|
| `MB_DB_TYPE` | `postgres` |
| `MB_DB_CONNECTION_URI` | `postgres://cmp-postgres.postgres.database.azure.com:5432/metabase?ssl=true&sslmode=require` |
| `MB_DB_USER` | `metabase_app` |
| `MB_DB_PASS` | `secretref:mb-db-pass` |
| `MB_ENCRYPTION_SECRET_KEY` | `secretref:mb-encryption-key` |
| `MB_SESSION_SECRET_KEY` | `secretref:mb-session-key` |
| `MB_SITE_URL` | URL pública de la Container App (`https://cmp-metabase.<...>.azurecontainerapps.io`) |
| `JAVA_OPTS` | `-Xmx1536m` |
| `JAVA_TIMEZONE` | `America/Santiago` |

## 4. Primer arranque

1. Abrir la URL: el asistente pide crear la cuenta de administrador. Saltar "agregar datos" o hacerlo aquí mismo.
2. **Admin → Databases → Add database** → PostgreSQL:
   - Host `cmp-postgres.postgres.database.azure.com`, puerto `5432`, base `cmp_db`
   - Usuario `metabase_lector` y su contraseña; **Use a secure connection (SSL)** activado
   - **Schemas → Only these… → `reportes`**
3. **Admin → Settings → Localization**: idioma Español, *Report timezone* `America/Santiago`.
4. **Admin → People**: crear la cuenta de quien diseña los dashboards (correo y contraseña; el SSO con Entra es de la
   versión de pago).

## 5. Embedding

1. **Admin → Settings → Embedding → Incrustación para invitados** (static embedding): activarla y copiar la clave de
   incrustación. Va en `cmp-backend`, nunca en el Frontend:

   | Variable | Valor |
   |---|---|
   | `METABASE_SITE_URL` | URL pública de `cmp-metabase` |
   | `METABASE_SECRET_KEY` | la clave de incrustación (como secret) |
   | `METABASE_DASHBOARD_OPERACION` | id del dashboard Operación: el número de su URL (`/dashboard/2-operacion` → `2`) |
   | `METABASE_DASHBOARD_ESTADO_PAGO` | id del dashboard Estado de pago |

   Sin ellas, `GET /dashboards/:tipo` responde 503 `METABASE_NO_CONFIGURADO`.
2. En cada dashboard: **Compartir → Incrustar → Incrustación para invitados** → configurar parámetros → **Publicar**.
   - Estado de pago: un filtro **Número** llamado exactamente `id_carga`, conectado a la columna `id_carga` de cada
     gráfico, en modo **Bloqueado**. La web lo fija con la carga vigente del mes elegido (`PARAMETRO_CARGA` en
     `obtener-dashboard.use-case.ts`).
   - Filtros de equipo, categoría o fecha que el usuario puede tocar: **Editable**.
   Publicar de nuevo después de cambiar los parámetros. Los gráficos se pueden editar sin volver a publicar.

## 6. Dashboards previstos

| Dashboard | Fuente | Filtros |
|---|---|---|
| **Operación** (en vivo, no depende del Excel) | `v_horas_app`, `v_estados_app` | Fecha (rango), categoría, equipo |
| **Estado de pago**, pestañas *Excel* y *Comparación* | `v_horas_excel`, `v_horas_app_ep`, `v_comparacion`, `v_horometros_excel` | `id_carga` (bloqueado), categoría, equipo |

`v_horas_app`, `v_horas_excel` y `v_horas_app_ep` tienen las mismas columnas (`equipo`, `categoria`, `fecha`,
`hora_inicio`, `horas`, `area`, `jornada`): un gráfico armado sobre una se replica en la otra cambiando solo la fuente.
Sumar siempre `horas`, no los horómetros (en `v_horas_app` se repiten si el turno pasó por varias áreas). Para
comparar por día usar `jornada`, no `fecha`: en el Excel el turno de noche de la tarde anterior ya es de la jornada
siguiente.

La carga del Excel la hace la web (ADMIN y JEFE_TURNO) con `POST /dashboards/cargas/previsualizar` y
`POST /dashboards/cargas`; del archivo solo se lee la hoja "Base de datos".
