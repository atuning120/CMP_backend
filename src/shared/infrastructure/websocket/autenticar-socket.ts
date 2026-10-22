import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

/**
 * Middleware de Socket.IO para los namespaces del panel web: el cliente manda su JWT en `auth.token`. Sin token válido
 * la conexión se rechaza con NO_AUTORIZADO, y con un rol fuera de `roles` con SIN_PERMISO. Cuando el JWT vence se corta
 * la conexión y el panel vuelve a conectarse con el token renovado.
 */
export const autenticarSocket =
  (jwtService: JwtService, roles?: string[]) =>
  (cliente: Socket, next: (error?: Error) => void) => {
    let payload: { exp?: number; rol?: string };
    try {
      const token: unknown = cliente.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Sin token');
      payload = jwtService.verify<{ exp?: number; rol?: string }>(token);
    } catch {
      return next(new Error('NO_AUTORIZADO'));
    }
    if (roles && !roles.includes(payload.rol ?? '')) return next(new Error('SIN_PERMISO'));

    if (payload.exp) {
      const vence = setTimeout(() => cliente.disconnect(true), payload.exp * 1000 - Date.now());
      cliente.once('disconnect', () => clearTimeout(vence));
    }
    next();
  };
