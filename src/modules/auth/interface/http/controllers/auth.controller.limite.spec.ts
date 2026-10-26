import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { LIMITE_INTENTOS } from '../../../infrastructure/limite-intentos';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LoginWebUseCase } from '../../../application/use-cases/login-web.use-case';
import { LoginWebCredencialesUseCase } from '../../../application/use-cases/login-web-credenciales.use-case';
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { RefrescarSesionUseCase } from '../../../application/use-cases/refrescar-sesion.use-case';
import { CerrarSesionUseCase } from '../../../application/use-cases/cerrar-sesion.use-case';
import { RefrescarSesionWebUseCase } from '../../../application/use-cases/refrescar-sesion-web.use-case';

// Todo login falla con credenciales inválidas: lo que se prueba es cuándo empieza a responder 429
const fallar = { execute: jest.fn(async () => Promise.reject(new UnauthorizedException())) };

describe('AuthController: límite de intentos', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(LIMITE_INTENTOS)],
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        LoginWebUseCase,
        LoginWebCredencialesUseCase,
        RegisterAdminUseCase,
        RefrescarSesionUseCase,
        RefrescarSesionWebUseCase,
        CerrarSesionUseCase,
      ].map((provide) => ({ provide, useValue: fallar })),
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (cuerpo: object) => request(app.getHttpServer()).post('/auth/login').send(cuerpo);

  it('bloquea una cuenta tras 10 intentos, aunque el RUT se escriba distinto', async () => {
    for (let i = 0; i < 10; i++) {
      await login({ rut: i % 2 ? '15.123.456-7' : '151234567', password: 'x' }).expect(401);
    }

    const bloqueado = await login({ rut: '15123456-7', password: 'x' }).expect(429);
    expect(bloqueado.body).toMatchObject({ code: 'DEMASIADOS_INTENTOS', message: expect.stringMatching(/Demasiados intentos/) });
  });

  it('el bloqueo de una cuenta no afecta a otra desde la misma IP', async () => {
    for (let i = 0; i < 11; i++) await login({ email: 'Ana.Rojas@cmp.cl', password: 'x' });

    await login({ email: 'ana.rojas@cmp.cl', password: 'x' }).expect(429);
    await login({ email: 'juan.perez@cmp.cl', password: 'x' }).expect(401);
  });

  it('refresh no tiene límite de intentos', async () => {
    for (let i = 0; i < 15; i++) {
      await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: 'x' }).expect(401);
    }
  });
});
