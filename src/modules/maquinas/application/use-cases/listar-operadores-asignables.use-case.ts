import { Inject, Injectable } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaRepositoryPort, OperadorAsignable } from '../../domain/repositories/maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import { ROLES_GESTION_FLOTA } from '../maquina.datos';

// Opciones del selector "Operador asignado" al incorporar o editar una máquina
@Injectable()
export class ListarOperadoresAsignablesUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(rol: string): Promise<OperadorAsignable[]> {
    if (!ROLES_GESTION_FLOTA.includes(rol)) throw maquinaError('SIN_PERMISO');
    return this.maquinaRepo.findOperadoresAsignables();
  }
}
