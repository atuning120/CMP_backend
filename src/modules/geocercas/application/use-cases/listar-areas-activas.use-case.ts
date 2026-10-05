import { Injectable, Inject } from '@nestjs/common';
import { GEOCERCA_REPOSITORY } from '../../domain/repositories/geocerca.repository.port';
import type { AreaResumen, GeocercaRepositoryPort } from '../../domain/repositories/geocerca.repository.port';

@Injectable()
export class ListarAreasActivasUseCase {
  constructor(
    @Inject(GEOCERCA_REPOSITORY)
    private readonly geocercaRepo: GeocercaRepositoryPort,
  ) {}

  async execute(): Promise<AreaResumen[]> {
    return this.geocercaRepo.findAreasActivas();
  }
}
