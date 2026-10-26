import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AlertasController } from './interface/http/controllers/alertas.controller';
import { ListarAlertasUseCase } from './application/use-cases/listar-alertas.use-case';
import { DetectarAlertasNuevasUseCase } from './application/use-cases/detectar-alertas-nuevas.use-case';
import { AtenderAlertaUseCase } from './application/use-cases/atender-alerta.use-case';
import { AtencionAlertaPostgresqlRepository } from './infrastructure/persistence/repositories/atencion-alerta.postgresql-repository';
import { ATENCION_ALERTA_REPOSITORY } from './domain/repositories/atencion-alerta.repository.port';
import { PUBLICADOR_ALERTAS } from './application/ports/publicador-alertas.port';
import { AlertaTurnoPostgresqlRepository } from './infrastructure/persistence/repositories/alerta-turno.postgresql-repository';
import { AlertasEnVivoScheduler } from './infrastructure/schedulers/alertas-en-vivo.scheduler';
import { AlertasGateway } from './infrastructure/websocket/alertas.gateway';
import { ALERTA_TURNO_REPOSITORY } from './domain/repositories/alerta-turno.repository.port';

// Alertas de turno: se calculan desde TURNO y su atención se guarda en ATENCION_ALERTA (la tabla ALERTA queda para las
// alertas de GPS). Las nuevas y sus atenciones se publican por WebSocket al panel web
@Module({
  imports: [TypeOrmModule.forFeature([]), AuthModule],
  controllers: [AlertasController],
  providers: [
    {
      provide: ALERTA_TURNO_REPOSITORY,
      useClass: AlertaTurnoPostgresqlRepository,
    },
    { provide: ATENCION_ALERTA_REPOSITORY, useClass: AtencionAlertaPostgresqlRepository },
    ListarAlertasUseCase,
    DetectarAlertasNuevasUseCase,
    AtenderAlertaUseCase,
    AlertasGateway,
    { provide: PUBLICADOR_ALERTAS, useExisting: AlertasGateway },
    AlertasEnVivoScheduler,
  ],
})
export class AlertasModule {}
