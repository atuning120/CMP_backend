import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Interface HTTP
import { TurnoController } from './interface/http/controllers/turno.controller';

// Use Cases (Application)
import { IniciarTurnoUseCase } from './application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from './application/use-cases/finalizar-turno.use-case';

// Persistence (Infrastructure)
import { TurnoOrmEntity } from './infrastructure/persistence/orm-entities/turno.orm-entity';
import { TurnoEstadoOrmEntity } from './infrastructure/persistence/orm-entities/turno-estado.orm-entity';
import { TurnoUbicacionOrmEntity } from './infrastructure/persistence/orm-entities/turno-ubicacion.orm-entity';
import { TurnoPostgresqlRepository } from './infrastructure/persistence/repositories/turno.postgresql-repository';

// DI Tokens
import { TURNO_REPOSITORY } from './domain/repositories/turno.repository.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TurnoOrmEntity,
      TurnoEstadoOrmEntity,
      TurnoUbicacionOrmEntity,
    ]),
  ],
  controllers: [TurnoController],
  providers: [
    {
      provide: TURNO_REPOSITORY,
      useClass: TurnoPostgresqlRepository,
    },
    IniciarTurnoUseCase,
    FinalizarTurnoUseCase,
  ],
  exports: [],
})
export class TurnosModule { }
