import { Module } from '@nestjs/common';
import { DashboardsController } from './interface/http/controllers/dashboards.controller';
import { PrevisualizarCargaEpUseCase } from './application/use-cases/previsualizar-carga-ep.use-case';
import { ConfirmarCargaEpUseCase } from './application/use-cases/confirmar-carga-ep.use-case';
import { ListarCargasEpUseCase } from './application/use-cases/listar-cargas-ep.use-case';
import { ObtenerDashboardUseCase } from './application/use-cases/obtener-dashboard.use-case';
import { CargaEpPostgresqlRepository } from './infrastructure/persistence/repositories/carga-ep.postgresql-repository';
import { LectorExcelEpExceljs } from './infrastructure/excel/lector-excel-ep.exceljs';
import { FirmadorDashboardMetabase } from './infrastructure/metabase/firmador-dashboard.metabase';
import { CARGA_EP_REPOSITORY } from './domain/repositories/carga-ep.repository.port';
import { LECTOR_EXCEL_EP } from './domain/ports/lector-excel-ep.port';
import { FIRMADOR_DASHBOARD } from './domain/ports/firmador-dashboard.port';

// Schema `reportes` (migración 016): lo escribe este módulo y lo lee Metabase. Ver docs/metabase.md
@Module({
  controllers: [DashboardsController],
  providers: [
    { provide: CARGA_EP_REPOSITORY, useClass: CargaEpPostgresqlRepository },
    { provide: LECTOR_EXCEL_EP, useClass: LectorExcelEpExceljs },
    { provide: FIRMADOR_DASHBOARD, useClass: FirmadorDashboardMetabase },
    PrevisualizarCargaEpUseCase,
    ConfirmarCargaEpUseCase,
    ListarCargasEpUseCase,
    ObtenerDashboardUseCase,
  ],
})
export class ReportesModule {}
