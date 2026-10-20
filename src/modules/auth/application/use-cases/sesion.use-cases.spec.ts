import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type {
  RefreshTokenRegistro,
  RefreshTokenRepositoryPort,
} from '../../domain/repositories/refresh-token.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { EmisorSesionService, hashRefreshToken } from '../services/emisor-sesion.service';
import { RefrescarSesionUseCase } from './refrescar-sesion.use-case';
import { RefrescarSesionWebUseCase } from './refrescar-sesion-web.use-case';
import { RotacionRefreshTokenService } from '../services/rotacion-refresh-token.service';
import { CerrarSesionUseCase } from './cerrar-sesion.use-case';

const AHORA = new Date('2026-10-05T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const TOKEN = 'token-del-dispositivo';

const crear = (registro: Partial<RefreshTokenRegistro> | null, usuario = { idUsuario: 7, rol: 'OPERADOR', idOperador: 21 } as
  { idUsuario: number; rol: string; idOperador: number | null } | null) => {
  const refreshTokenRepo = {
    create: jest.fn<Promise<void>, [{ idUsuario: number; tokenHash: string; expiraEn: Date }]>(async () => undefined),
    findByHash: jest.fn<Promise<RefreshTokenRegistro | null>, [string]>(async (hash) =>
      registro && hash === hashRefreshToken(TOKEN)
        ? { idRefreshToken: 1, idUsuario: 7, expiraEn: new Date(AHORA.getTime() + DIA), revocadoEn: null, ...registro }
        : null,
    ),
    revocar: jest.fn<Promise<void>, [number, Date]>(async () => undefined),
    revocarTodosDelUsuario: jest.fn<Promise<void>, [number, Date]>(async () => undefined),
  } satisfies RefreshTokenRepositoryPort;
  const usuarioRepo = {
    findByEmail: jest.fn(),
    findByIdOperador: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(async () => usuario),
  } satisfies UsuarioRepositoryPort;
  const sign = jest.fn(() => 'jwt-firmado');
  const jwt = { sign } as unknown as JwtService;
  const config = { get: jest.fn((_key: string, def: string) => def) } as unknown as ConfigService;
  const emisor = new EmisorSesionService(jwt, config, refreshTokenRepo);
  const rotacion = new RotacionRefreshTokenService(refreshTokenRepo, usuarioRepo);
  return {
    refreshTokenRepo,
    sign,
    refrescar: new RefrescarSesionUseCase(rotacion, emisor),
    refrescarWeb: new RefrescarSesionWebUseCase(rotacion, emisor),
  };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('EmisorSesionService', () => {
  it('guarda solo el hash del refresh token, con expiración a 30 días', async () => {
    const { refreshTokenRepo } = crear(null);
    const emisor = new EmisorSesionService(
      { sign: () => 'jwt' } as unknown as JwtService,
      { get: (_k: string, d: string) => d } as unknown as ConfigService,
      refreshTokenRepo,
    );

    const sesion = await emisor.emitir({ idUsuario: 7, rol: 'OPERADOR', idOperador: 21 }, AHORA);

    const guardado = refreshTokenRepo.create.mock.calls[0][0];
    expect(guardado.tokenHash).toBe(hashRefreshToken(sesion.refreshToken));
    expect(guardado.tokenHash).not.toBe(sesion.refreshToken);
    expect(guardado.expiraEn).toEqual(new Date(AHORA.getTime() + 30 * DIA));
    expect(sesion).toMatchObject({ accessToken: 'jwt', rol: 'OPERADOR', idOperador: 21 });
  });
});

describe('RefrescarSesionUseCase', () => {
  it('rota el token: revoca el usado y entrega uno nuevo', async () => {
    const { refrescar, refreshTokenRepo } = crear({});

    const sesion = await refrescar.execute(TOKEN, AHORA);

    expect(refreshTokenRepo.revocar.mock.calls).toEqual([[1, AHORA]]);
    expect(sesion.refreshToken).not.toBe(TOKEN);
    expect(sesion).toMatchObject({ accessToken: 'jwt-firmado', rol: 'OPERADOR', idOperador: 21 });
  });

  it('rechaza un token desconocido o expirado', async () => {
    expect(await codigoDe(crear({}).refrescar.execute('otro', AHORA))).toBe('SESION_INVALIDA');
    expect(await codigoDe(crear({ expiraEn: AHORA }).refrescar.execute(TOKEN, AHORA))).toBe('SESION_INVALIDA');
    expect(await codigoDe(crear({}).refrescar.execute(undefined, AHORA))).toBe('SESION_INVALIDA');
  });

  it('acepta un token rotado hace menos de 60 s (respuesta perdida por mala señal)', async () => {
    const { refrescar } = crear({ revocadoEn: new Date(AHORA.getTime() - 30 * 1000) });
    await expect(refrescar.execute(TOKEN, AHORA)).resolves.toMatchObject({ rol: 'OPERADOR' });
  });

  it('si se reutiliza un token rotado hace más de 60 s, cierra todas las sesiones del usuario', async () => {
    const { refrescar, refreshTokenRepo } = crear({ revocadoEn: new Date(AHORA.getTime() - 5 * 60 * 1000) });

    expect(await codigoDe(refrescar.execute(TOKEN, AHORA))).toBe('SESION_INVALIDA');
    expect(refreshTokenRepo.revocarTodosDelUsuario.mock.calls).toEqual([[7, AHORA]]);
  });

  it('un usuario desactivado o sin acceso a la app no puede renovar', async () => {
    expect(await codigoDe(crear({}, null).refrescar.execute(TOKEN, AHORA))).toBe('SESION_INVALIDA');
    expect(await codigoDe(crear({}, { idUsuario: 7, rol: 'VISOR', idOperador: null }).refrescar.execute(TOKEN, AHORA))).toBe(
      'SESION_INVALIDA',
    );
  });
});

describe('RefrescarSesionWebUseCase', () => {
  it.each(['ADMIN', 'JEFE_TURNO', 'VISOR'])('rota el token de un %s y entrega su rol actual', async (rol) => {
    const { refrescarWeb, refreshTokenRepo, sign } = crear({}, { idUsuario: 7, rol, idOperador: null });

    const sesion = await refrescarWeb.execute(TOKEN, AHORA);

    expect(refreshTokenRepo.revocar.mock.calls).toEqual([[1, AHORA]]);
    expect(sesion.refreshToken).not.toBe(TOKEN);
    expect(sesion).toMatchObject({ accessToken: 'jwt-firmado', rol });
    expect(sign).toHaveBeenCalledWith({ sub: 7, rol });
  });

  it('un operador no puede renovar una sesión web: se cierran sus sesiones', async () => {
    const { refrescarWeb, refreshTokenRepo } = crear({});

    expect(await codigoDe(refrescarWeb.execute(TOKEN, AHORA))).toBe('SESION_INVALIDA');
    expect(refreshTokenRepo.revocarTodosDelUsuario.mock.calls).toEqual([[7, AHORA]]);
  });

  it('comparte las reglas de la app: token desconocido, expirado, reutilizado o usuario desactivado', async () => {
    expect(await codigoDe(crear({}, { idUsuario: 7, rol: 'ADMIN', idOperador: null }).refrescarWeb.execute('otro', AHORA))).toBe(
      'SESION_INVALIDA',
    );
    expect(await codigoDe(crear({ expiraEn: AHORA }, { idUsuario: 7, rol: 'ADMIN', idOperador: null }).refrescarWeb.execute(TOKEN, AHORA))).toBe(
      'SESION_INVALIDA',
    );
    expect(
      await codigoDe(
        crear({ revocadoEn: new Date(AHORA.getTime() - 5 * 60 * 1000) }, { idUsuario: 7, rol: 'ADMIN', idOperador: null }).refrescarWeb.execute(
          TOKEN,
          AHORA,
        ),
      ),
    ).toBe('SESION_INVALIDA');
    expect(await codigoDe(crear({}, null).refrescarWeb.execute(TOKEN, AHORA))).toBe('SESION_INVALIDA');
  });
});

describe('CerrarSesionUseCase', () => {
  it('revoca el token del dispositivo y es idempotente', async () => {
    const { refreshTokenRepo } = crear({});
    const cerrar = new CerrarSesionUseCase(refreshTokenRepo);

    await cerrar.execute(TOKEN, AHORA);
    await cerrar.execute('desconocido', AHORA);
    await cerrar.execute(undefined, AHORA);

    expect(refreshTokenRepo.revocar.mock.calls).toEqual([[1, AHORA]]);
  });
});
