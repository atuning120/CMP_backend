import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaController } from './interface/http/controllers/area.controller';
import { ZonaController } from './interface/http/controllers/zona.controller';
import { ListarAreasActivasUseCase } from './application/use-cases/listar-areas-activas.use-case';
import { ListarZonasActivasUseCase } from './application/use-cases/listar-zonas-activas.use-case';
import { AreaOrmEntity } from './infrastructure/persistence/orm-entities/area.orm-entity';
import { ZonaTrabajoOrmEntity } from './infrastructure/persistence/orm-entities/zona-trabajo.orm-entity';
import { GeocercaPostgresqlRepository } from './infrastructure/persistence/repositories/geocerca.postgresql-repository';
import { GEOCERCA_REPOSITORY } from './domain/repositories/geocerca.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([AreaOrmEntity, ZonaTrabajoOrmEntity])],
  controllers: [AreaController, ZonaController],
  providers: [
    {
      provide: GEOCERCA_REPOSITORY,
      useClass: GeocercaPostgresqlRepository,
    },
    ListarAreasActivasUseCase,
    ListarZonasActivasUseCase,
  ],
  exports: [GEOCERCA_REPOSITORY],
})
export class GeocercasModule {}
