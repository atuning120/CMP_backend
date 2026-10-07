import { Injectable, Inject } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';

const LARGO_MAXIMO_BUSQUEDA = 100;

@Injectable()
export class ListarFlotaUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(busqueda?: string): Promise<MaquinaFlota[]> {
    const texto = (busqueda ?? '').trim().slice(0, LARGO_MAXIMO_BUSQUEDA);
    return this.maquinaRepo.findFlota(texto === '' ? null : texto);
  }
}
