import { Module } from '@nestjs/common';
import { HistorialController } from './interface/http/controllers/historial.controller';
import { ListarHistorialUseCase } from './application/use-cases/listar-historial.use-case';
import { HistorialPostgresqlRepository } from './infrastructure/persistence/repositories/historial.postgresql-repository';
import { HISTORIAL_REPOSITORY } from './domain/repositories/historial.repository.port';

// Solo lectura: combina BITACORA_JEFE_TURNO (que escribe el módulo maquinas) con TURNO
@Module({
  controllers: [HistorialController],
  providers: [
    {
      provide: HISTORIAL_REPOSITORY,
      useClass: HistorialPostgresqlRepository,
    },
    ListarHistorialUseCase,
  ],
})
export class HistorialModule {}
