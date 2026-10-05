import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenciaController } from './interface/http/controllers/evidencia.controller';
import { CrearReporteUseCase } from './application/use-cases/crear-reporte.use-case';
import { SubirEvidenciaUseCase } from './application/use-cases/subir-evidencia.use-case';
import { ObtenerArchivoEvidenciaUseCase } from './application/use-cases/obtener-archivo-evidencia.use-case';
import { ReporteTurnoOrmEntity } from './infrastructure/persistence/orm-entities/reporte-turno.orm-entity';
import { EvidenciaOrmEntity } from './infrastructure/persistence/orm-entities/evidencia.orm-entity';
import { ReportePostgresqlRepository } from './infrastructure/persistence/repositories/reporte.postgresql-repository';
import { EvidenciaPostgresqlRepository } from './infrastructure/persistence/repositories/evidencia.postgresql-repository';
import { AlmacenamientoLocal } from './infrastructure/storage/almacenamiento-local';
import { REPORTE_REPOSITORY } from './domain/repositories/reporte.repository.port';
import { EVIDENCIA_REPOSITORY } from './domain/repositories/evidencia.repository.port';
import { ALMACENAMIENTO_ARCHIVOS } from './domain/ports/almacenamiento-archivos.port';
import { TurnosModule } from '../turnos/turnos.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReporteTurnoOrmEntity, EvidenciaOrmEntity]), TurnosModule],
  controllers: [EvidenciaController],
  providers: [
    { provide: REPORTE_REPOSITORY, useClass: ReportePostgresqlRepository },
    { provide: EVIDENCIA_REPOSITORY, useClass: EvidenciaPostgresqlRepository },
    { provide: ALMACENAMIENTO_ARCHIVOS, useClass: AlmacenamientoLocal },
    CrearReporteUseCase,
    SubirEvidenciaUseCase,
    ObtenerArchivoEvidenciaUseCase,
  ],
  exports: [],
})
export class EvidenciasModule {}
