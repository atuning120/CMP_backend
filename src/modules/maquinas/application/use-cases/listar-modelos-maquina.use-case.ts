import { Injectable, Inject } from '@nestjs/common';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquina, ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';

@Injectable()
export class ListarModelosMaquinaUseCase {
  constructor(
    @Inject(MODELO_MAQUINA_REPOSITORY)
    private readonly modeloRepo: ModeloMaquinaRepositoryPort,
  ) {}

  async execute(): Promise<ModeloMaquina[]> {
    return this.modeloRepo.findActivos();
  }
}
