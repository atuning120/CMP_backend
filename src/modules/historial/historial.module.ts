import { Module } from '@nestjs/common';
import { HistorialController } from './interface/http/controllers/historial.controller';
import { ListarHistorialUseCase } from './application/use-cases/listar-historial.use-case';
import { ExportarHistorialUseCase } from './application/use-cases/exportar-historial.use-case';
import { HistorialPostgresqlRepository } from './infrastructure/persistence/repositories/historial.postgresql-repository';
import { HistorialExcelExceljs } from './infrastructure/excel/historial-excel.exceljs';
import { HISTORIAL_REPOSITORY } from './domain/repositories/historial.repository.port';
import { HISTORIAL_EXCEL } from './domain/ports/historial-excel.port';

// Solo lectura: combina BITACORA_JEFE_TURNO (que escribe el módulo maquinas) con TURNO
@Module({
  controllers: [HistorialController],
  providers: [
    {
      provide: HISTORIAL_REPOSITORY,
      useClass: HistorialPostgresqlRepository,
    },
    {
      provide: HISTORIAL_EXCEL,
      useClass: HistorialExcelExceljs,
    },
    ListarHistorialUseCase,
    ExportarHistorialUseCase,
  ],
})
export class HistorialModule {}
