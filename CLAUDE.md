# Backend

NestJS 12 · TypeScript · TypeORM + PostgreSQL · JWT/Passport · Jest · pnpm

- `src/modules/<name>/`: hexagonal layers `domain/` → `application/` → `infrastructure/` and `interface/http/`; `src/shared/` for cross-module code
- Domain imports only `shared`. Use cases depend on `*.repository.port.ts`, never on ORM entities.
- DB schema: `docs/database_schema.md`
- Before finishing: `pnpm lint` and `pnpm test`

## graphify

- Find code with `graphify query "<q>"`, `graphify explain "<X>"` or `graphify path "<A>" "<B>"`; read `graphify-out/GRAPH_REPORT.md` only for an architecture overview.
- After code changes: `graphify update .`
