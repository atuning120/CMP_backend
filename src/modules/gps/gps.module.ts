import { Module } from '@nestjs/common';
import { GpsController } from './interface/http/controllers/gps.controller';
import { ListarGpsUseCase } from './application/use-cases/listar-gps.use-case';
import { RegistrarGpsUseCase } from './application/use-cases/registrar-gps.use-case';
import { EditarGpsUseCase } from './application/use-cases/editar-gps.use-case';
import { CambiarAsignacionGpsUseCase } from './application/use-cases/cambiar-asignacion-gps.use-case';
import { GPS_REPOSITORY } from './domain/repositories/gps.repository.port';
import { GpsPostgresqlRepository } from './infrastructure/persistence/repositories/gps.postgresql-repository';

// GPS reales (Jimi LL301) y la máquina en que está cada uno. Sus posiciones las guarda el módulo tracking
@Module({
  controllers: [GpsController],
  providers: [
    { provide: GPS_REPOSITORY, useClass: GpsPostgresqlRepository },
    ListarGpsUseCase,
    RegistrarGpsUseCase,
    EditarGpsUseCase,
    CambiarAsignacionGpsUseCase,
  ],
})
export class GpsModule {}
