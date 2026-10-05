import { Injectable, Inject } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaRepositoryPort, MaquinaResumen } from '../../domain/repositories/maquina.repository.port';

@Injectable()
export class ListarMaquinasActivasUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(): Promise<MaquinaResumen[]> {
    return this.maquinaRepo.findActivas();
  }
}
