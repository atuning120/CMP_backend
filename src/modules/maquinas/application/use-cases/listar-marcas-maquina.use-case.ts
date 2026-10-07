import { Injectable, Inject } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';

@Injectable()
export class ListarMarcasMaquinaUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(): Promise<string[]> {
    return this.maquinaRepo.findMarcas();
  }
}
