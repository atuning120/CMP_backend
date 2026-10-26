import { Inject, Injectable, Logger } from '@nestjs/common';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import type { CambiarEstadoUsuarioDto } from '../dtos/cambiar-estado-usuario.dto';
import { usuarioError } from '../usuario.errors';

/**
 * Activa o desactiva un usuario (solo ADMIN). Se desactiva en vez de borrar para conservar su historial
 * (turnos, bitácora, geocercas). Un usuario inactivo no puede iniciar sesión ni renovarla: su sesión abierta
 * termina cuando vence el access token. No se desactiva la propia cuenta ni la del administrador principal (.env),
 * y siempre queda un administrador activo.
 */
@Injectable()
export class CambiarEstadoUsuarioUseCase {
  private readonly logger = new Logger(CambiarEstadoUsuarioUseCase.name);

  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
  ) {}

  async execute({ idUsuario, activo, autor }: CambiarEstadoUsuarioDto): Promise<UsuarioAdministrable> {
    if (autor?.rol !== 'ADMIN' || !autor.idUsuario) throw usuarioError('SIN_PERMISO');
    if (typeof activo !== 'boolean') throw usuarioError('ESTADO_INVALIDO');

    const usuario = await this.usuarioRepo.findAdministrable(idUsuario);
    if (!usuario) throw usuarioError('USUARIO_NO_ENCONTRADO');
    if (usuario.idUsuario === autor.idUsuario) throw usuarioError('PROPIO_ESTADO');
    if (usuario.esPrincipal && !activo) throw usuarioError('ADMIN_PRINCIPAL');
    if (usuario.activo === activo) return usuario;

    if (!activo && usuario.rol === 'ADMIN' && (await this.usuarioRepo.contarAdminsActivos()) <= 1) {
      throw usuarioError('ULTIMO_ADMIN');
    }

    await this.usuarioRepo.cambiarActivo(idUsuario, activo);
    this.logger.log(`Usuario ${autor.idUsuario} ${activo ? 'activó' : 'desactivó'} al usuario ${idUsuario}`);
    return { ...usuario, activo };
  }
}
