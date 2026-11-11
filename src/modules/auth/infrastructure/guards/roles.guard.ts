import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type Rol = 'ADMIN' | 'JEFE_TURNO' | 'VISOR' | 'OPERADOR';

// Cualquier usuario con sesión: la app (OPERADOR, JEFE_TURNO) y el panel web (VISOR, JEFE_TURNO, ADMIN)
export const TODOS_LOS_ROLES: Rol[] = ['ADMIN', 'JEFE_TURNO', 'VISOR', 'OPERADOR'];

export const ROLES_KEY = 'roles';

// 403 y no 401: el panel web toma un 401 como sesión vencida y cierra la sesión
const sinPermiso = () =>
  new ForbiddenException({ statusCode: 403, code: 'SIN_PERMISO', message: 'No tienes permiso para realizar esta acción' });

/**
 * Exige que el rol del JWT esté entre los declarados con @Roles en la ruta o en su controller. Va después de
 * JwtAuthGuard (@UseGuards(JwtAuthGuard, RolesGuard)), que deja el usuario en req.user.
 * Falla cerrado: una ruta sin @Roles no la puede usar nadie, así una ruta nueva no queda abierta por olvido.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles) {
      this.logger.error(`Ruta sin @Roles: ${context.getClass().name}.${context.getHandler().name}. Se rechaza`);
      throw sinPermiso();
    }
    const rol = context.switchToHttp().getRequest<{ user?: { rol?: string } }>().user?.rol;
    if (!rol || !(roles as string[]).includes(rol)) throw sinPermiso();
    return true;
  }
}
