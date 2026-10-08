import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasController } from './interface/http/controllers/alertas.controller';
import { ListarAlertasUseCase } from './application/use-cases/listar-alertas.use-case';
import { AlertaTurnoPostgresqlRepository } from './infrastructure/persistence/repositories/alerta-turno.postgresql-repository';
import { ALERTA_TURNO_REPOSITORY } from './domain/repositories/alerta-turno.repository.port';

// Alertas de turno: solo lectura sobre TURNO (la tabla ALERTA queda para las alertas de GPS)
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [AlertasController],
  providers: [
    {
      provide: ALERTA_TURNO_REPOSITORY,
      useClass: AlertaTurnoPostgresqlRepository,
    },
    ListarAlertasUseCase,
  ],
})
export class AlertasModule {}
