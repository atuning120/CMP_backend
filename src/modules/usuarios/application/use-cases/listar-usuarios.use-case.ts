import { Inject, Injectable } from '@nestjs/common';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import { usuarioError } from '../usuario.errors';

// Todos los usuarios (activos o no) para la página de administración del panel web
@Injectable()
export class ListarUsuariosUseCase {
  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
  ) {}

  async execute(rolAutor: string): Promise<UsuarioAdministrable[]> {
    if (rolAutor !== 'ADMIN') throw usuarioError('SIN_PERMISO');
    return this.usuarioRepo.listar();
  }
}
