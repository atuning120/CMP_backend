import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { GESTION_USUARIOS_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { GestionUsuariosRepositoryPort } from '../../domain/repositories/usuario.repository.port';
import { AdminPrincipalConfig } from '../admin-principal';
import { ACCESO_MICROSOFT, accesoConPassword, leerEmail, leerPassword } from '../datos-usuario';

/**
 * Al arrancar el Backend, deja al administrador principal del .env creado, como ADMIN y activo. Si
 * ADMIN_PRINCIPAL_PASSWORD cambió, actualiza su contraseña (y cierra sus sesiones): así se recupera el acceso
 * si la olvida. Un error aquí se registra pero no impide que el Backend arranque.
 */
@Injectable()
export class AsegurarAdminPrincipalService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AsegurarAdminPrincipalService.name);

  constructor(
    @Inject(GESTION_USUARIOS_REPOSITORY)
    private readonly usuarioRepo: GestionUsuariosRepositoryPort,
    private readonly principal: AdminPrincipalConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.principal.email) {
      this.logger.warn('Sin ADMIN_PRINCIPAL_EMAIL: no hay administrador principal protegido');
      return;
    }
    try {
      await this.asegurar(this.principal.email);
    } catch (error) {
      // Nunca la contraseña: solo el motivo
      this.logger.error(`No se pudo asegurar el administrador principal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async asegurar(emailConfigurado: string): Promise<void> {
    const email = leerEmail(emailConfigurado);
    const password = leerPassword(this.principal.password);

    const usuario = await this.usuarioRepo.findAdministrablePorEmail(email);
    if (!usuario) {
      const idUsuario = await this.usuarioRepo.crear({
        email,
        nombre: this.principal.nombre,
        rol: 'ADMIN',
        ...(password ? await accesoConPassword(password) : ACCESO_MICROSOFT),
        operador: null,
      });
      this.logger.log(`Administrador principal creado (usuario ${idUsuario}, ${password ? 'con contraseña' : 'con Microsoft'})`);
      return;
    }

    if (usuario.rol !== 'ADMIN') {
      await this.usuarioRepo.cambiarRol(usuario.idUsuario, 'ADMIN');
      this.logger.warn(`El administrador principal tenía rol ${usuario.rol}: se restableció a ADMIN`);
    }
    if (!usuario.activo) {
      await this.usuarioRepo.cambiarActivo(usuario.idUsuario, true);
      this.logger.warn('El administrador principal estaba inactivo: se reactivó');
    }

    if (password) {
      const hashActual = await this.usuarioRepo.passwordHashDe(usuario.idUsuario);
      if (!hashActual || !(await bcrypt.compare(password, hashActual))) {
        await this.usuarioRepo.actualizar(usuario.idUsuario, {
          email: usuario.email,
          nombre: usuario.nombre,
          acceso: await accesoConPassword(password),
          operador: null,
        });
        this.logger.log('Contraseña del administrador principal actualizada desde ADMIN_PRINCIPAL_PASSWORD');
      }
    }
  }
}
