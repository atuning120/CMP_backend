import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Interface HTTP
import { TurnoController } from './interface/http/controllers/turno.controller';
import { EstadoOperacionalController } from './interface/http/controllers/estado-operacional.controller';

// Use Cases (Application)
import { IniciarTurnoUseCase } from './application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from './application/use-cases/finalizar-turno.use-case';
import { ObtenerTurnoActualUseCase } from './application/use-cases/obtener-turno-actual.use-case';
import { CerrarTurnosExcedidosUseCase } from './application/use-cases/cerrar-turnos-excedidos.use-case';
import { RegistrarEstadoUseCase } from './application/use-cases/registrar-estado.use-case';
import { ListarEstadosOperacionalesUseCase } from './application/use-cases/listar-estados-operacionales.use-case';

// Persistence (Infrastructure)
import { TurnoOrmEntity } from './infrastructure/persistence/orm-entities/turno.orm-entity';
import { TurnoEstadoOrmEntity } from './infrastructure/persistence/orm-entities/turno-estado.orm-entity';
import { TurnoUbicacionOrmEntity } from './infrastructure/persistence/orm-entities/turno-ubicacion.orm-entity';
import { TurnoPostgresqlRepository } from './infrastructure/persistence/repositories/turno.postgresql-repository';
import { TurnoEstadoPostgresqlRepository } from './infrastructure/persistence/repositories/turno-estado.postgresql-repository';
import { EstadoOperacionalOrmEntity } from './infrastructure/persistence/orm-entities/estado-operacional.orm-entity';
import { CierreAutomaticoTurnosScheduler } from './infrastructure/schedulers/cierre-automatico-turnos.scheduler';

// DI Tokens
import { TURNO_REPOSITORY } from './domain/repositories/turno.repository.port';
import { TURNO_ESTADO_REPOSITORY } from './domain/repositories/turno-estado.repository.port';

// Other modules
import { MaquinasModule } from '../maquinas/maquinas.module';
import { GeocercasModule } from '../geocercas/geocercas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TurnoOrmEntity,
      TurnoEstadoOrmEntity,
      TurnoUbicacionOrmEntity,
      EstadoOperacionalOrmEntity,
    ]),
    MaquinasModule,
    GeocercasModule,
  ],
  controllers: [TurnoController, EstadoOperacionalController],
  providers: [
    {
      provide: TURNO_REPOSITORY,
      useClass: TurnoPostgresqlRepository,
    },
    {
      provide: TURNO_ESTADO_REPOSITORY,
      useClass: TurnoEstadoPostgresqlRepository,
    },
    IniciarTurnoUseCase,
    FinalizarTurnoUseCase,
    ObtenerTurnoActualUseCase,
    CerrarTurnosExcedidosUseCase,
    CierreAutomaticoTurnosScheduler,
    RegistrarEstadoUseCase,
    ListarEstadosOperacionalesUseCase,
  ],
  // Evidencias resuelve el turno de un reporte por su idCliente
  exports: [TURNO_REPOSITORY],
})
export class TurnosModule { }
