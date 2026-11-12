import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, TODOS_LOS_ROLES } from '../../../infrastructure/guards/roles.guard';
import type { Rol } from '../../../infrastructure/guards/roles.guard';

export { TODOS_LOS_ROLES };
export type { Rol };

/**
 * Roles que pueden llamar a la ruta (o a todas las del controller, si va en la clase; la del método manda).
 * Lo aplica RolesGuard, que va junto a JwtAuthGuard: toda ruta con JWT debe declararlo, o responde 403
 * (lo verifica roles-cobertura.spec.ts). Los use cases conservan su propio control como segunda barrera.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
