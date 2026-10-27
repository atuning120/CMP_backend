# Backend

NestJS 12 · TypeScript · TypeORM + PostgreSQL · JWT/Passport · Jest · pnpm

- `src/modules/<name>/`: hexagonal layers `domain/` → `application/` → `infrastructure/` and `interface/http/`; `src/shared/` for cross-module code
- Domain imports only `shared`. Use cases depend on `*.repository.port.ts`, never on ORM entities.
- DB schema: `docs/database_schema.md` (ER diagram, FKs, module mapping); DDL source of truth `docs/database/schema.sql`, test data `docs/database/seed.sql`. Tables and FKs are in graphify (`graphify explain "TURNO"`); SQL extraction needs `graphifyy[sql]`
- Tracking: the adaptador (`../adaptador`) posts GPS positions to `POST /tracking/posiciones` (guard `X-Api-Key` = env `ADAPTADOR_API_KEY`); they are pushed to the web panel over Socket.IO, namespace `/tracking`, event `posiciones` (JWT in `auth.token`). Interim virtual GPS per machine: IMEI `'9' + id_maquina` (migration 010)
- Alertas de turno: computed from TURNO and TURNO_ESTADO (never stored): shift/journey over 10 h (`E-`/`J-`), auto close (`A-`), MANTENCION-category state (`M-<id_turno_estado>`); `AlertasEnVivoScheduler` diffs the last 24 h every minute and pushes new ones over Socket.IO, namespace `/alertas`, event `alertas` `{ nuevas, activas }` (JEFE_TURNO/ADMIN only; shared JWT middleware `shared/infrastructure/websocket/autenticar-socket.ts`)
- Estado operacional en vivo: the app posts state changes straight to `POST /turnos/estados` (not via the adaptador); `RegistrarEstadoUseCase` pushes the turn's current state over Socket.IO, namespace `/estados`, event `estados` `{ idMaquina, idTurno, estadoOperacional }` (any role). `/maquinas/flota` includes `estadoOperacional` so the web map colors each machine by category
- Before finishing: `pnpm lint` and `pnpm test`
- Deploy: Azure Container Apps (Express env) via `./scripts/deploy-azure.sh vN` — needs OCI images (buildx) and digest-based updates; env vars/secrets live in the Container App, never in the image

## graphify

- Find code with `graphify query "<q>"`, `graphify explain "<X>"` or `graphify path "<A>" "<B>"`; read `graphify-out/GRAPH_REPORT.md` only for an architecture overview.
- After code changes: `graphify update .`

# Claude Code Configuration

Responde siempre en español. Mantén en inglés (sin traducir) todos los términos técnicos, nombres de herramientas, tecnologías y librerías: API, REST, database, backend, framework, Git, Docker, Linux, Node.js, Python, JavaScript, JSON, etc.