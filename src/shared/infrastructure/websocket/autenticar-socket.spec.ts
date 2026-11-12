import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { autenticarSocket, REVISION_SOCKET_MS } from './autenticar-socket';
import type { VerificadorSesion } from './autenticar-socket';

const jwtService = {
  verify: jest.fn((token: string) => {
    if (token === 'invalido') throw new Error('jwt malformed');
    return { sub: 1, rol: token, exp: Math.floor(Date.now() / 1000) + 3600 };
  }),
} as unknown as JwtService;

const verificador = (...respuestas: (boolean | Error)[]) => {
  const vigente = jest.fn<Promise<boolean>, []>();
  respuestas.forEach((r) => vigente.mockImplementationOnce(() => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r))));
  vigente.mockResolvedValue(respuestas.at(-1) === true);
  return { vigente } as VerificadorSesion & { vigente: jest.Mock };
};

const cliente = (token?: string) => {
  const alDesconectar: (() => void)[] = [];
  const socket = {
    handshake: { auth: { token } },
    once: jest.fn((evento: string, fn: () => void) => evento === 'disconnect' && alDesconectar.push(fn)),
    disconnect: jest.fn(() => alDesconectar.forEach((fn) => fn())),
  };
  return socket as unknown as Socket & { disconnect: jest.Mock };
};

describe('autenticarSocket', () => {
  afterEach(() => jest.useRealTimers());

  it('rechaza una conexión sin token o con un token inválido', async () => {
    const next = jest.fn();
    await autenticarSocket(jwtService, verificador(true))(cliente(), next);
    await autenticarSocket(jwtService, verificador(true))(cliente('invalido'), next);
    expect(next).toHaveBeenNthCalledWith(1, new Error('NO_AUTORIZADO'));
    expect(next).toHaveBeenNthCalledWith(2, new Error('NO_AUTORIZADO'));
  });

  it('rechaza un rol fuera de los permitidos', async () => {
    const next = jest.fn();
    await autenticarSocket(jwtService, verificador(true), ['JEFE_TURNO', 'ADMIN'])(cliente('VISOR'), next);
    expect(next).toHaveBeenCalledWith(new Error('SIN_PERMISO'));
  });

  it('rechaza con NO_AUTORIZADO a un usuario desactivado o con otro rol (el panel renueva la sesión)', async () => {
    const next = jest.fn();
    await autenticarSocket(jwtService, verificador(false))(cliente('ADMIN'), next);
    expect(next).toHaveBeenCalledWith(new Error('NO_AUTORIZADO'));
  });

  it('rechaza si no se puede verificar el usuario (la base no responde)', async () => {
    const next = jest.fn();
    await autenticarSocket(jwtService, verificador(new Error('sin conexión')))(cliente('ADMIN'), next);
    expect(next).toHaveBeenCalledWith(new Error('NO_AUTORIZADO'));
  });

  it('acepta un token válido de un usuario vigente con un rol permitido', async () => {
    const next = jest.fn();
    await autenticarSocket(jwtService, verificador(true), ['JEFE_TURNO', 'ADMIN'])(cliente('ADMIN'), next);
    await autenticarSocket(jwtService, verificador(true))(cliente('VISOR'), next);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('corta el socket abierto cuando el usuario deja de estar vigente', async () => {
    jest.useFakeTimers();
    const socket = cliente('ADMIN');
    const sesion = verificador(true, true, false);
    await autenticarSocket(jwtService, sesion)(socket, jest.fn());

    await jest.advanceTimersByTimeAsync(REVISION_SOCKET_MS);
    expect(socket.disconnect).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(REVISION_SOCKET_MS);
    expect(socket.disconnect).toHaveBeenCalledWith(true);

    // Desconectado, deja de revisar
    await jest.advanceTimersByTimeAsync(REVISION_SOCKET_MS * 3);
    expect(sesion.vigente).toHaveBeenCalledTimes(3);
  });

  it('no corta el socket si la revisión falla por la base', async () => {
    jest.useFakeTimers();
    const socket = cliente('ADMIN');
    await autenticarSocket(jwtService, verificador(true, new Error('sin conexión'), true))(socket, jest.fn());
    await jest.advanceTimersByTimeAsync(REVISION_SOCKET_MS * 2);
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.disconnect();
  });

  it('corta el socket cuando vence el JWT', async () => {
    jest.useFakeTimers();
    const socket = cliente('ADMIN');
    await autenticarSocket(jwtService, verificador(true))(socket, jest.fn());
    await jest.advanceTimersByTimeAsync(3600 * 1000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
