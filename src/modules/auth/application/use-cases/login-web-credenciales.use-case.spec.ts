import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { LoginWebCredencialesUseCase } from './login-web-credenciales.use-case';
import { EmisorSesionService } from '../services/emisor-sesion.service';

const PASSWORD = 'Secreta123';

const crear = async (usuario: { rol: string; passwordHash?: string | null } | null) => {
  const passwordHash = usuario?.passwordHash === undefined ? await bcrypt.hash(PASSWORD, 4) : usuario.passwordHash;
  const usuarioRepo = {
    findByEmail: jest.fn(async () => (usuario ? { idUsuario: 9, rol: usuario.rol, passwordHash, idOperador: null, nombre: 'Usuario Web', email: 'web@cmp.cl' } : null)),
    findByIdOperador: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  } satisfies UsuarioRepositoryPort;
  const jwt = { sign: jest.fn(() => 'jwt-firmado') };
  const config = { get: (_clave: string, def: string) => def } as unknown as ConfigService;
  const refreshTokenRepo = { create: jest.fn(async () => undefined), findByHash: jest.fn(), revocar: jest.fn(), revocarTodosDelUsuario: jest.fn() };
  const emisor = new EmisorSesionService(jwt as unknown as JwtService, config, refreshTokenRepo);
  return { jwt, refreshTokenRepo, useCase: new LoginWebCredencialesUseCase(usuarioRepo, emisor) };
};

const codigoDe = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('LoginWebCredencialesUseCase', () => {
  it.each(['ADMIN', 'JEFE_TURNO', 'VISOR'])('entrega los tokens y el rol a un %s', async (rol) => {
    const { jwt, refreshTokenRepo, useCase } = await crear({ rol });

    const sesion = await useCase.execute({ email: 'ana@cmp.cl', password: PASSWORD });

    expect(sesion).toEqual({ accessToken: 'jwt-firmado', refreshToken: expect.any(String), refreshTokenExpiraEn: expect.any(String), rol });
    expect(refreshTokenRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idUsuario: 9 }));
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 9, rol });
  });

  it('rechaza a un operador con SIN_ACCESO_WEB', async () => {
    const { useCase } = await crear({ rol: 'OPERADOR' });

    expect(await codigoDe(useCase.execute({ email: 'op@cmp.cl', password: PASSWORD }))).toBe('SIN_ACCESO_WEB');
  });

  it('no revela si la cuenta existe: usuario inexistente, sin contraseña o contraseña incorrecta', async () => {
    expect(await codigoDe((await crear(null)).useCase.execute({ email: 'x@cmp.cl', password: PASSWORD }))).toBe('CREDENCIALES_INVALIDAS');
    expect(await codigoDe((await crear({ rol: 'ADMIN', passwordHash: null })).useCase.execute({ email: 'x@cmp.cl', password: PASSWORD }))).toBe('CREDENCIALES_INVALIDAS');
    expect(await codigoDe((await crear({ rol: 'ADMIN' })).useCase.execute({ email: 'x@cmp.cl', password: 'otra' }))).toBe('CREDENCIALES_INVALIDAS');
  });

  it('exige email y contraseña', async () => {
    const { useCase } = await crear({ rol: 'ADMIN' });

    expect(await codigoDe(useCase.execute({ email: ' ', password: PASSWORD }))).toBe('DATOS_INCOMPLETOS');
    expect(await codigoDe(useCase.execute({ email: 'ana@cmp.cl', password: '' }))).toBe('DATOS_INCOMPLETOS');
  });
});
