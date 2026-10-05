import { Injectable, Inject } from '@nestjs/common';
import { TURNO_ESTADO_REPOSITORY } from '../../domain/repositories/turno-estado.repository.port';
import type { EstadoOperacionalResumen, TurnoEstadoRepositoryPort } from '../../domain/repositories/turno-estado.repository.port';

@Injectable()
export class ListarEstadosOperacionalesUseCase {
  constructor(
    @Inject(TURNO_ESTADO_REPOSITORY)
    private readonly turnoEstadoRepo: TurnoEstadoRepositoryPort,
  ) {}

  async execute(): Promise<EstadoOperacionalResumen[]> {
    return this.turnoEstadoRepo.findCatalogoActivo();
  }
}
