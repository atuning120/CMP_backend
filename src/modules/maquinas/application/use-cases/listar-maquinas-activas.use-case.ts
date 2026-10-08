import { Injectable, Inject } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaCatalogo, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';

@Injectable()
export class ListarMaquinasActivasUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(): Promise<MaquinaCatalogo[]> {
    return this.maquinaRepo.findActivas();
  }
}
