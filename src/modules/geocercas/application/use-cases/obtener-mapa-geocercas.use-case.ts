import { Inject, Injectable } from '@nestjs/common';
import { GEOCERCA_ESCRITURA_REPOSITORY } from '../../domain/repositories/geocerca.repository.port';
import type { AreaMapa, GeocercaEscrituraPort, ZonaMapa } from '../../domain/repositories/geocerca.repository.port';

// Áreas y zonas activas con sus polígonos (GeoJSON) para el mapa del panel web
@Injectable()
export class ObtenerMapaGeocercasUseCase {
  constructor(
    @Inject(GEOCERCA_ESCRITURA_REPOSITORY)
    private readonly geocercaRepo: GeocercaEscrituraPort,
  ) {}

  async execute(): Promise<{ areas: AreaMapa[]; zonas: ZonaMapa[] }> {
    return this.geocercaRepo.findMapa();
  }
}
