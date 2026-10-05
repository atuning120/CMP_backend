---
name: new-nest-module
description: Scaffold a new feature module or use case in the Backend following its hexagonal layout. Use when adding a module, endpoint, use case, repository or ORM entity.
---

# New Nest module / use case

Use `src/modules/turnos/` as the reference implementation and mirror its naming.

1. **Domain** `src/modules/<name>/domain/`
   - `entities/<x>.entity.ts`: plain TS, no Nest or TypeORM imports
   - `repositories/<x>.repository.port.ts`: abstract class or token plus interface
2. **Application** `application/`
   - `use-cases/<verb>-<x>.use-case.ts`: injectable; depends only on ports
   - `dtos/<verb>-<x>.dto.ts`
3. **Infrastructure** `infrastructure/persistence/`
   - `orm-entities/<x>.orm-entity.ts`: TypeORM entity matching `docs/database_schema.md`
   - `repositories/<x>.postgresql-repository.ts`: implements the port and maps ORM ↔ domain
4. **Interface** `interface/http/`
   - `controllers/<x>.controller.ts`, `dtos/<verb>-<x>.request.dto.ts`
   - Protect routes with `JwtAuthGuard` from `modules/auth`
5. **Module** `<name>.module.ts`: `TypeOrmModule.forFeature([...])`, bind port → implementation, and register it in `app.module.ts`

The layer rules are enforced by `eslint-plugin-boundaries` (`.eslintrc.js`): domain imports only `shared`.

Finish with `pnpm lint && pnpm test`, and add a `*.spec.ts` for each new use case.
