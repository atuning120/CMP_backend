import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

// Cada cuánto se revisa que el usuario de un socket abierto siga activo y con el mismo rol
export const REVISION_SOCKET_MS = 30 * 1000;

// Lo implementa VerificadorSesionService (módulo auth): usuario activo y con el rol con que se emitió el token
export interface VerificadorSesion {
  vigente(payload: { sub: number; rol?: string; idOperador?: number | null }): Promise<boolean>;
}

type PayloadSocket = { sub: number; exp?: number; rol?: string; idOperador?: number | null };

/**
 * Middleware de Socket.IO para los namespaces del panel web: el cliente manda su JWT en `auth.token`. Sin token válido,
 * o si el usuario ya no está activo o cambió de rol, la conexión se rechaza con NO_AUTORIZADO (el panel renueva la
 * sesión y reintenta); con un rol fuera de `roles`, con SIN_PERMISO. La conexión se corta cuando el JWT vence y
 * también si, ya conectado, el usuario es desactivado o cambia de rol (se revisa cada REVISION_SOCKET_MS): el panel
 * vuelve a conectarse con el token renovado, o deja de hacerlo si ya no tiene sesión.
 */
export const autenticarSocket =
  (jwtService: JwtService, verificador: VerificadorSesion, roles?: string[]) =>
  async (cliente: Socket, next: (error?: Error) => void) => {
    let payload: PayloadSocket;
    try {
      const token: unknown = cliente.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Sin token');
      payload = jwtService.verify<PayloadSocket>(token);
    } catch {
      return next(new Error('NO_AUTORIZADO'));
    }
    if (roles && !roles.includes(payload.rol ?? '')) return next(new Error('SIN_PERMISO'));
    if (!(await verificador.vigente(payload).catch(() => false))) return next(new Error('NO_AUTORIZADO'));

    const vence = payload.exp ? setTimeout(() => cliente.disconnect(true), payload.exp * 1000 - Date.now()) : undefined;
    const revision = setInterval(() => {
      // Si la base falla, el socket sigue: se vuelve a revisar en la próxima vuelta
      verificador.vigente(payload).then(
        (vigente) => {
          if (!vigente) cliente.disconnect(true);
        },
        () => undefined,
      );
    }, REVISION_SOCKET_MS);
    cliente.once('disconnect', () => {
      clearTimeout(vence);
      clearInterval(revision);
    });
    next();
  };
