import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrackingController } from './interface/http/controllers/tracking.controller';
import { RegistrarPosicionesUseCase } from './application/use-cases/registrar-posiciones.use-case';
import { ObtenerUltimasPosicionesUseCase } from './application/use-cases/obtener-ultimas-posiciones.use-case';
import { PUBLICADOR_POSICIONES } from './application/ports/publicador-posiciones.port';
import { TRACKING_REPOSITORY } from './domain/repositories/tracking.repository.port';
import { ApiKeyAdaptadorGuard } from './infrastructure/guards/api-key-adaptador.guard';
import { TrackingPostgresqlRepository } from './infrastructure/persistence/repositories/tracking.postgresql-repository';
import { TrackingGateway } from './infrastructure/websocket/tracking.gateway';

// Posiciones GPS: las recibe del adaptador, las guarda en TRACKING_HISTORY y las publica por WebSocket
@Module({
  imports: [AuthModule],
  controllers: [TrackingController],
  providers: [
    { provide: TRACKING_REPOSITORY, useClass: TrackingPostgresqlRepository },
    TrackingGateway,
    { provide: PUBLICADOR_POSICIONES, useExisting: TrackingGateway },
    ApiKeyAdaptadorGuard,
    RegistrarPosicionesUseCase,
    ObtenerUltimasPosicionesUseCase,
  ],
})
export class TrackingModule {}
