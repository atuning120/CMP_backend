# Graph Report - Backend  (2026-10-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 396 nodes · 628 edges · 29 communities (14 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7196d436`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27

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
- `OperadorPostgresqlRepository` --implements--> `OperadorRepositoryPort`  [EXTRACTED]
  src/modules/operadores/infrastructure/persistence/repositories/operador.postgresql-repository.ts → src/modules/operadores/domain/repositories/operador.repository.port.ts
- `UsuarioPostgresqlRepository` --implements--> `UsuarioRepositoryPort`  [EXTRACTED]
  src/modules/usuarios/infrastructure/persistence/repositories/usuario.postgresql-repository.ts → src/modules/usuarios/domain/repositories/usuario.repository.port.ts
- `TurnoPostgresqlRepository` --implements--> `TurnoRepositoryPort`  [EXTRACTED]
  src/modules/turnos/infrastructure/persistence/repositories/turno.postgresql-repository.ts → src/modules/turnos/domain/repositories/turno.repository.port.ts

## Import Cycles
- None detected.

## Communities (29 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (12): FinalizarTurnoDto, IniciarTurnoDto, FinalizarTurnoUseCase, IniciarTurnoUseCase, Turno, TURNO_REPOSITORY, TurnoRepositoryPort, TurnoEstadoOrmEntity (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (42): config, { config: tsconfig }, author, description, license, name, private, version (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (12): bcryptjs, @nestjs/config, @nestjs/jwt, LoginOperadorUseCase, LoginWebUseCase, RegisterOperadorUseCase, AuthController, LoginRequestDto (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (9): @nestjs/passport, passport-jwt, JwtAuthGuard, JwtPayload, JwtStrategy, CurrentUser, TurnoController, FinalizarTurnoRequestDto (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (24): devDependencies, eslint-plugin-boundaries, jest, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (9): @nestjs/common, @nestjs/typeorm, AlertasModule, AuthModule, EvidenciasModule, GeocercasModule, MaquinasModule, OperadoresModule (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (19): dependencies, bcryptjs, jsonwebtoken, jwks-rsa, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/event-emitter (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (4): USUARIO_REPOSITORY, UsuarioOrmEntity, UsuarioPostgresqlRepository, UsuariosModule

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (14): scripts, build, deploy, format, lint, start, start:debug, start:dev (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (3): fs, moduleMap, schema

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (6): ./tsconfig.json, compilerOptions, rootDir, exclude, extends, include

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

## Knowledge Gaps
- **122 isolated node(s):** `JwtPayload`, `config`, `{ config: tsconfig }`, `author`, `description` (+117 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 212 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 8`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **Why does `typeorm` connect `Community 17` to `Community 0`, `Community 1`, `Community 8`, `Community 11`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `JwtPayload`, `config`, `{ config: tsconfig }` to the rest of the system?**
  _122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06883116883116883 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04521276595744681 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10101010101010101 - nodes in this community are weakly interconnected._