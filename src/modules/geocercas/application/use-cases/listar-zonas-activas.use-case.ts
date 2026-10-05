import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { GEOCERCA_REPOSITORY } from '../../domain/repositories/geocerca.repository.port';
import type { GeocercaRepositoryPort, ZonaTrabajoResumen } from '../../domain/repositories/geocerca.repository.port';

@Injectable()
export class ListarZonasActivasUseCase {
  constructor(
    @Inject(GEOCERCA_REPOSITORY)
    private readonly geocercaRepo: GeocercaRepositoryPort,
  ) {}

  // Sin área: todas las zonas activas (la app las descarga de una vez para tenerlas offline)
  async todas(): Promise<ZonaTrabajoResumen[]> {
    return this.geocercaRepo.findZonasActivas();
  }

  async execute(idArea: number): Promise<ZonaTrabajoResumen[]> {
    const area = await this.geocercaRepo.findAreaById(idArea);
    if (!area) {
      throw new NotFoundException({ statusCode: 404, code: 'AREA_NO_ENCONTRADA', message: 'Área no encontrada' });
    }
    return this.geocercaRepo.findZonasActivasByArea(idArea);
  }
}
