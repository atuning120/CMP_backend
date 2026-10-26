import { Inject, Injectable, Logger } from '@nestjs/common';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import type { CambiarRolUsuarioDto } from '../dtos/cambiar-rol-usuario.dto';
import { usuarioError } from '../usuario.errors';

// Roles del panel web. OPERADOR no se asigna aquí: depende de una ficha de operador y usa la app móvil
export const ROLES_ASIGNABLES = ['VISOR', 'JEFE_TURNO', 'ADMIN'];

/**
 * Cambia el rol de un usuario (solo ADMIN). Quien entra por primera vez con Microsoft queda como VISOR
 * hasta que un administrador lo cambia aquí. Reglas: no se cambia el propio rol, no se tocan usuarios con rol OPERADOR
 * ni el del administrador principal (.env), y siempre debe quedar al menos un administrador activo. El nuevo rol rige desde su próximo login.
 */
@Injectable()
export class CambiarRolUsuarioUseCase {
  private readonly logger = new Logger(CambiarRolUsuarioUseCase.name);

  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
  ) {}

  async execute({ idUsuario, rol, autor }: CambiarRolUsuarioDto): Promise<UsuarioAdministrable> {
    if (autor?.rol !== 'ADMIN' || !autor.idUsuario) throw usuarioError('SIN_PERMISO');
    if (typeof rol !== 'string' || !ROLES_ASIGNABLES.includes(rol)) throw usuarioError('ROL_INVALIDO');

    const usuario = await this.usuarioRepo.findAdministrable(idUsuario);
    if (!usuario) throw usuarioError('USUARIO_NO_ENCONTRADO');
    // Un OPERADOR usa la app móvil y su rol va ligado a su ficha: no se cambia desde aquí.
    // Un usuario con rol web sí, aunque tenga una ficha de operador asociada
    if (usuario.rol === 'OPERADOR') throw usuarioError('ROL_NO_EDITABLE');
    if (usuario.esPrincipal) throw usuarioError('ADMIN_PRINCIPAL');
    if (usuario.idUsuario === autor.idUsuario) throw usuarioError('PROPIO_ROL');
    if (usuario.rol === rol) return usuario;

    if (usuario.rol === 'ADMIN' && usuario.activo && (await this.usuarioRepo.contarAdminsActivos()) <= 1) {
      throw usuarioError('ULTIMO_ADMIN');
    }

    await this.usuarioRepo.cambiarRol(idUsuario, rol);
    this.logger.log(`Usuario ${autor.idUsuario} cambió el rol del usuario ${idUsuario}: ${usuario.rol} -> ${rol}`);
    return { ...usuario, rol };
  }
}
