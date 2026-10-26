import { Inject, Injectable, Logger } from '@nestjs/common';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { AccesoUsuario, GestionUsuariosRepositoryPort, UsuarioAdministrable } from '../../domain/repositories/usuario.repository.port';
import type { EditarUsuarioDto } from '../dtos/editar-usuario.dto';
import { ACCESO_MICROSOFT, accesoConPassword, leerEmail, leerFichaOperador, leerNombreCompleto, leerPassword } from '../datos-usuario';
import { usuarioError } from '../usuario.errors';

/**
 * Edita los datos de un usuario (solo ADMIN): nombre, correo, ficha del operador y forma de entrar.
 * - Un operador edita nombre, apellido, RUT y teléfono de su ficha; un usuario web, su nombre completo.
 * - Restablecer contraseña: se escribe una nueva (vacía = se mantiene la actual). Pasar a Microsoft quita
 *   la contraseña; dejar Microsoft exige una. Cualquier cambio de acceso cierra sus sesiones abiertas.
 * - El administrador no cambia su propio acceso desde aquí: lo dejaría fuera de su sesión.
 * - El administrador principal (.env) solo lo edita él mismo, y sin cambiar su correo.
 */
@Injectable()
export class EditarUsuarioUseCase {
  private readonly logger = new Logger(EditarUsuarioUseCase.name);

  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
  ) {}

  async execute({ idUsuario, datos, autor }: EditarUsuarioDto): Promise<UsuarioAdministrable> {
    if (autor?.rol !== 'ADMIN' || !autor.idUsuario) throw usuarioError('SIN_PERMISO');

    const usuario = await this.usuarioRepo.findAdministrable(idUsuario);
    if (!usuario) throw usuarioError('USUARIO_NO_ENCONTRADO');

    // El administrador principal solo se edita a sí mismo, y su correo lo fija el .env
    if (usuario.esPrincipal && usuario.idUsuario !== autor.idUsuario) throw usuarioError('ADMIN_PRINCIPAL_SOLO_PROPIO');
    const email = leerEmail(datos?.email);
    if (usuario.esPrincipal && email !== usuario.email.toLowerCase()) throw usuarioError('EMAIL_PRINCIPAL_FIJO');
    // La ficha solo se edita si la persona usa la app como operador; con rol web manda su nombre de usuario
    const ficha = usuario.rol === 'OPERADOR' && usuario.operador ? leerFichaOperador(datos) : null;
    const nombre = ficha ? `${ficha.nombre} ${ficha.apellido}` : leerNombreCompleto(datos.nombre);

    const acceso = await this.nuevoAcceso(usuario, datos.accesoMicrosoft === true, leerPassword(datos.password));
    if (acceso && usuario.idUsuario === autor.idUsuario) throw usuarioError('PROPIO_ACCESO');

    if (await this.usuarioRepo.existeEmail(email, usuario.idUsuario)) throw usuarioError('EMAIL_EN_USO');
    if (ficha && (await this.usuarioRepo.existeRut(ficha.rut, usuario.operador!.idOperador))) throw usuarioError('RUT_EN_USO');

    await this.usuarioRepo.actualizar(idUsuario, {
      email,
      nombre,
      acceso,
      operador: ficha ? { ...ficha, idOperador: usuario.operador!.idOperador } : null,
    });

    // Nunca la contraseña: solo qué cambió
    const detalle = acceso ? (acceso.passwordHash ? ' y restableció su contraseña' : ' y lo pasó a Microsoft') : '';
    this.logger.log(`Usuario ${autor.idUsuario} editó al usuario ${idUsuario}${detalle}`);

    const editado = await this.usuarioRepo.findAdministrable(idUsuario);
    if (!editado) throw usuarioError('USUARIO_NO_ENCONTRADO');
    return editado;
  }

  // El acceso que hay que guardar, o null si no cambia
  private async nuevoAcceso(usuario: UsuarioAdministrable, conMicrosoft: boolean, password: string | null): Promise<AccesoUsuario | null> {
    const teniaPassword = usuario.proveedorAuth === 'CREDENCIALES';
    if (conMicrosoft) {
      if (usuario.rol === 'OPERADOR') throw usuarioError('MICROSOFT_SIN_APP');
      return teniaPassword ? ACCESO_MICROSOFT : null;
    }
    if (password) return accesoConPassword(password);
    if (!teniaPassword) throw usuarioError('PASSWORD_REQUERIDA');
    return null;
  }
}
