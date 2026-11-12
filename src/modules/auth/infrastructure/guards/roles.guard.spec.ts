import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from '../../interface/http/decorators/roles.decorator';

@Roles('JEFE_TURNO', 'ADMIN')
class ControllerConRoles {
  heredada() {}
  @Roles('OPERADOR')
  propia() {}
}

class ControllerSinRoles {
  olvidada() {}
}

const contexto = (clase: new () => object, metodo: string, user?: { rol?: string }): ExecutionContext =>
  ({
    getClass: () => clase,
    getHandler: () => (clase.prototype as Record<string, () => void>)[metodo],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deja pasar un rol declarado en el controller', () => {
    expect(guard.canActivate(contexto(ControllerConRoles, 'heredada', { rol: 'ADMIN' }))).toBe(true);
  });

  it('rechaza un rol que no está declarado, con 403 SIN_PERMISO (nunca 401: el panel cerraría la sesión)', () => {
    let error: unknown;
    try {
      guard.canActivate(contexto(ControllerConRoles, 'heredada', { rol: 'VISOR' }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ statusCode: 403, code: 'SIN_PERMISO' });
  });

  it('los roles de la ruta reemplazan a los del controller', () => {
    expect(guard.canActivate(contexto(ControllerConRoles, 'propia', { rol: 'OPERADOR' }))).toBe(true);
    expect(() => guard.canActivate(contexto(ControllerConRoles, 'propia', { rol: 'ADMIN' }))).toThrow(ForbiddenException);
  });

  it('rechaza sin usuario o sin rol', () => {
    expect(() => guard.canActivate(contexto(ControllerConRoles, 'heredada'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto(ControllerConRoles, 'heredada', {}))).toThrow(ForbiddenException);
  });

  it('falla cerrado: una ruta sin @Roles no la puede usar nadie, ni un ADMIN', () => {
    expect(() => guard.canActivate(contexto(ControllerSinRoles, 'olvidada', { rol: 'ADMIN' }))).toThrow(ForbiddenException);
  });
});
