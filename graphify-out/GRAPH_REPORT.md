# Graph Report - Backend  (2026-10-05)

## Corpus Check
- 70 files · ~7,972 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 3, .example 1)

## Summary
- 401 nodes · 632 edges · 31 communities (13 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5cb7ca33`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- turnos.module.ts
- package.json
- auth.module.ts
- jwt.strategy.ts
- devDependencies
- @nestjs/common
- compilerOptions
- dependencies
- typeorm
- scripts
- AppService
- UsuarioPostgresqlRepository
- generate_entities.js
- .oxlintrc.json
- tsconfig.build.json
- nest-cli.json
- TurnoEstadoOrmEntity
- ReporteTurnoOrmEntity
- AlertaOrmEntity
- EvidenciaOrmEntity
- AreaOrmEntity
- MaquinaOrmEntity
- AuditoriaGeocercaOrmEntity
- ZonaTrabajoOrmEntity
- AsignacionGpsOrmEntity
- DispositivoGpsOrmEntity
- TrackingHistoryOrmEntity
- EstadoOperacionalOrmEntity
- TurnoUbicacionOrmEntity
- Backend

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 27 edges
2. `typeorm` - 20 edges
3. `compilerOptions` - 20 edges
4. `Turno` - 16 edges
5. `scripts` - 14 edges
6. `@nestjs/typeorm` - 13 edges
7. `UsuarioRepositoryPort` - 12 edges
8. `TurnoRepositoryPort` - 11 edges
9. `TurnoPostgresqlRepository` - 10 edges
10. `OperadorRepositoryPort` - 9 edges

## Surprising Connections (you probably didn't know these)
- `New Nest module / use case` --references--> `JwtAuthGuard`  [INFERRED]
  .claude/skills/new-nest-module/SKILL.md → src/modules/auth/infrastructure/guards/jwt-auth.guard.ts
- `UsuarioPostgresqlRepository` --implements--> `UsuarioRepositoryPort`  [EXTRACTED]
  src/modules/usuarios/infrastructure/persistence/repositories/usuario.postgresql-repository.ts → src/modules/usuarios/domain/repositories/usuario.repository.port.ts
- `TurnoPostgresqlRepository` --implements--> `TurnoRepositoryPort`  [EXTRACTED]
  src/modules/turnos/infrastructure/persistence/repositories/turno.postgresql-repository.ts → src/modules/turnos/domain/repositories/turno.repository.port.ts
- `OperadorPostgresqlRepository` --implements--> `OperadorRepositoryPort`  [EXTRACTED]
  src/modules/operadores/infrastructure/persistence/repositories/operador.postgresql-repository.ts → src/modules/operadores/domain/repositories/operador.repository.port.ts

## Import Cycles
- None detected.

## Communities (31 total, 18 thin omitted)

### Community 0 - "turnos.module.ts"
Cohesion: 0.07
Nodes (13): CurrentUser, FinalizarTurnoDto, IniciarTurnoDto, FinalizarTurnoUseCase, IniciarTurnoUseCase, Turno, TURNO_REPOSITORY, TurnoRepositoryPort (+5 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (42): config, { config: tsconfig }, author, description, license, name, private, version (+34 more)

### Community 2 - "auth.module.ts"
Cohesion: 0.07
Nodes (17): bcryptjs, @nestjs/config, @nestjs/jwt, LoginOperadorUseCase, LoginWebUseCase, RegisterOperadorUseCase, AuthController, LoginRequestDto (+9 more)

### Community 3 - "jwt.strategy.ts"
Cohesion: 0.15
Nodes (6): New Nest module / use case, @nestjs/passport, passport-jwt, JwtAuthGuard, JwtPayload, JwtStrategy

### Community 4 - "devDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint-plugin-boundaries, jest, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint (+16 more)

### Community 5 - "@nestjs/common"
Cohesion: 0.14
Nodes (10): @nestjs/common, @nestjs/typeorm, AlertasModule, AuthModule, EvidenciasModule, GeocercasModule, MaquinasModule, TrackingModule (+2 more)

### Community 6 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+12 more)

### Community 7 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, bcryptjs, jsonwebtoken, jwks-rsa, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/event-emitter (+11 more)

### Community 9 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, deploy, format, lint, start, start:debug, start:dev (+6 more)

### Community 12 - "generate_entities.js"
Cohesion: 0.29
Nodes (3): fs, moduleMap, schema

### Community 13 - ".oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 14 - "tsconfig.build.json"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, rootDir, exclude, extends, include

### Community 15 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

## Knowledge Gaps
- **123 isolated node(s):** `graphify`, `JwtPayload`, `config`, `{ config: tsconfig }`, `author` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 215 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `@nestjs/common` to `turnos.module.ts`, `package.json`, `auth.module.ts`, `jwt.strategy.ts`, `typeorm`, `AppService`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `typeorm` connect `typeorm` to `turnos.module.ts`, `package.json`, `auth.module.ts`, `TurnoEstadoOrmEntity`, `ReporteTurnoOrmEntity`, `AlertaOrmEntity`, `EvidenciaOrmEntity`, `AreaOrmEntity`, `MaquinaOrmEntity`, `AuditoriaGeocercaOrmEntity`, `ZonaTrabajoOrmEntity`, `AsignacionGpsOrmEntity`, `DispositivoGpsOrmEntity`, `TrackingHistoryOrmEntity`, `EstadoOperacionalOrmEntity`, `TurnoUbicacionOrmEntity`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `graphify`, `JwtPayload`, `config` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `turnos.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07305669199298656 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.04521276595744681 - nodes in this community are weakly interconnected._
- **Should `auth.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._