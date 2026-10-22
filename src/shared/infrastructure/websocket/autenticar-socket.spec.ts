import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { autenticarSocket } from './autenticar-socket';

const jwtService = {
  verify: jest.fn((token: string) => {
    if (token === 'invalido') throw new Error('jwt malformed');
    return { rol: token, exp: Math.floor(Date.now() / 1000) + 60 };
  }),
} as unknown as JwtService;

const cliente = (token?: string) => {
  const once = jest.fn();
  return { socket: { handshake: { auth: { token } }, once, disconnect: jest.fn() } as unknown as Socket, once };
};

describe('autenticarSocket', () => {
  it('rechaza una conexión sin token o con un token inválido', () => {
    const next = jest.fn();
    autenticarSocket(jwtService)(cliente().socket, next);
    autenticarSocket(jwtService)(cliente('invalido').socket, next);
    expect(next).toHaveBeenNthCalledWith(1, new Error('NO_AUTORIZADO'));
    expect(next).toHaveBeenNthCalledWith(2, new Error('NO_AUTORIZADO'));
  });

  it('rechaza un rol fuera de los permitidos', () => {
    const next = jest.fn();
    autenticarSocket(jwtService, ['JEFE_TURNO', 'ADMIN'])(cliente('VISOR').socket, next);
    expect(next).toHaveBeenCalledWith(new Error('SIN_PERMISO'));
  });

  it('acepta un token válido con un rol permitido y programa el corte al vencer', () => {
    const next = jest.fn();
    const { socket, once } = cliente('ADMIN');
    autenticarSocket(jwtService, ['JEFE_TURNO', 'ADMIN'])(socket, next);
    autenticarSocket(jwtService)(cliente('VISOR').socket, next);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
    expect(once).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });
});
