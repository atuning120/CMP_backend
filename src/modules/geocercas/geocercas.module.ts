import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaController } from './interface/http/controllers/area.controller';
import { ZonaController } from './interface/http/controllers/zona.controller';
import { GeocercaController } from './interface/http/controllers/geocerca.controller';
import { ObtenerMapaGeocercasUseCase } from './application/use-cases/obtener-mapa-geocercas.use-case';
import { GestionarGeocercasUseCase } from './application/use-cases/gestionar-geocercas.use-case';
import { ListarAreasActivasUseCase } from './application/use-cases/listar-areas-activas.use-case';
import { ListarZonasActivasUseCase } from './application/use-cases/listar-zonas-activas.use-case';
import { AreaOrmEntity } from './infrastructure/persistence/orm-entities/area.orm-entity';
import { ZonaTrabajoOrmEntity } from './infrastructure/persistence/orm-entities/zona-trabajo.orm-entity';
import { GeocercaPostgresqlRepository } from './infrastructure/persistence/repositories/geocerca.postgresql-repository';
import { GEOCERCA_ESCRITURA_REPOSITORY, GEOCERCA_REPOSITORY } from './domain/repositories/geocerca.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([AreaOrmEntity, ZonaTrabajoOrmEntity])],
  controllers: [AreaController, ZonaController, GeocercaController],
  providers: [
    GeocercaPostgresqlRepository,
    { provide: GEOCERCA_REPOSITORY, useExisting: GeocercaPostgresqlRepository },
    { provide: GEOCERCA_ESCRITURA_REPOSITORY, useExisting: GeocercaPostgresqlRepository },
    ListarAreasActivasUseCase,
    ListarZonasActivasUseCase,
    ObtenerMapaGeocercasUseCase,
    GestionarGeocercasUseCase,
  ],
  exports: [GEOCERCA_REPOSITORY],
})
export class GeocercasModule {}
