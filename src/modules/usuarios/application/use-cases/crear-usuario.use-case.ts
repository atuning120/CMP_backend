import { Inject, Injectable, Logger } from '@nestjs/common';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import type { CrearUsuarioDto } from '../dtos/crear-usuario.dto';
import { ACCESO_MICROSOFT, accesoConPassword, leerEmail, leerFichaOperador, leerNombreYApellido, leerPassword } from '../datos-usuario';
import { usuarioError } from '../usuario.errors';
import { ROLES_ASIGNABLES } from './cambiar-rol-usuario.use-case';

// Además de los roles web, un administrador da de alta a los operadores de la app móvil
export const ROLES_CREABLES = [...ROLES_ASIGNABLES, 'OPERADOR'];

/**
 * Alta de usuarios desde el panel web (solo ADMIN); reemplaza a los antiguos registros públicos.
 * - accesoMicrosoft: la persona entra solo con su cuenta Microsoft (sin contraseña); la cuenta se vincula
 *   por correo en su primer login. Solo para roles web: la app móvil no tiene login con Microsoft.
 * - Si no, la contraseña es obligatoria.
 * - OPERADOR: además exige RUT y crea su ficha de operador.
 */
@Injectable()
export class CrearUsuarioUseCase {
  private readonly logger = new Logger(CrearUsuarioUseCase.name);

  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
  ) {}

  async execute({ datos, autor }: CrearUsuarioDto): Promise<UsuarioAdministrable> {
    if (autor?.rol !== 'ADMIN' || !autor.idUsuario) throw usuarioError('SIN_PERMISO');

    const rol = datos?.rol;
    if (typeof rol !== 'string' || !ROLES_CREABLES.includes(rol)) throw usuarioError('ROL_INVALIDO');

    const esOperador = rol === 'OPERADOR';
    const { nombre, apellido } = leerNombreYApellido(datos);
    const email = leerEmail(datos.email);
    const operador = esOperador ? leerFichaOperador(datos) : null;

    const conMicrosoft = datos.accesoMicrosoft === true;
    if (conMicrosoft && esOperador) throw usuarioError('MICROSOFT_SIN_APP');
    const password = conMicrosoft ? null : leerPassword(datos.password);
    if (!conMicrosoft && !password) throw usuarioError('PASSWORD_REQUERIDA');

    if (await this.usuarioRepo.existeEmail(email)) throw usuarioError('EMAIL_EN_USO');
    if (operador && (await this.usuarioRepo.existeRut(operador.rut))) throw usuarioError('RUT_EN_USO');

    const idUsuario = await this.usuarioRepo.crear({
      email,
      nombre: `${nombre} ${apellido}`,
      rol,
      ...(password ? await accesoConPassword(password) : ACCESO_MICROSOFT),
      operador,
    });

    this.logger.log(`Usuario ${autor.idUsuario} creó el usuario ${idUsuario} con rol ${rol}`);
    const creado = await this.usuarioRepo.findAdministrable(idUsuario);
    if (!creado) throw usuarioError('USUARIO_NO_ENCONTRADO');
    return creado;
  }
}
