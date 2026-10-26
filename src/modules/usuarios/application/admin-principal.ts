import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Administrador principal, definido en el .env del Backend:
 * - ADMIN_PRINCIPAL_EMAIL: su correo (sin esta variable no hay administrador principal)
 * - ADMIN_PRINCIPAL_NOMBRE: nombre con que se crea (opcional)
 * - ADMIN_PRINCIPAL_PASSWORD: su contraseña (opcional; sin ella entra con Microsoft). Es la única forma de
 *   cambiarla: nadie la restablece desde el panel web
 * Al arrancar se asegura que exista, sea ADMIN y esté activo. Desde el panel nadie lo desactiva ni le cambia el rol.
 */
@Injectable()
export class AdminPrincipalConfig {
  readonly email: string | null;
  readonly nombre: string;
  readonly password: string | null;

  constructor(config: ConfigService) {
    this.email = config.get<string>('ADMIN_PRINCIPAL_EMAIL')?.trim().toLowerCase() || null;
    this.nombre = config.get<string>('ADMIN_PRINCIPAL_NOMBRE')?.trim() || 'Administrador principal';
    this.password = config.get<string>('ADMIN_PRINCIPAL_PASSWORD') || null;
  }

  es(email: string): boolean {
    return this.email !== null && email.trim().toLowerCase() === this.email;
  }
}
