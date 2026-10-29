import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
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

const SESION = { accessToken: 'jwt', refreshToken: 'refresh-nuevo', refreshTokenExpiraEn: '2099-01-01T00:00:00.000Z', rol: 'ADMIN' };

describe('AuthController: sesión web en cookie', () => {
  let app: INestApplication;
  const loginWebCredenciales = { execute: jest.fn() };
  const refrescarWeb = { execute: jest.fn() };
  const cerrarSesion = { execute: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    loginWebCredenciales.execute.mockResolvedValue(SESION);
    refrescarWeb.execute.mockResolvedValue(SESION);
    const modulo = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(LIMITE_INTENTOS)],
      controllers: [AuthController],
      providers: [
        { provide: LoginWebCredencialesUseCase, useValue: loginWebCredenciales },
        { provide: RefrescarSesionWebUseCase, useValue: refrescarWeb },
        { provide: CerrarSesionUseCase, useValue: cerrarSesion },
        ...[LoginUseCase, LoginWebUseCase, RegisterAdminUseCase, RefrescarSesionUseCase].map((provide) => ({
          provide,
          useValue: { execute: jest.fn() },
        })),
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (ruta: string) => request(app.getHttpServer()).post(ruta);

  it('con X-Sesion-Web el login deja el refresh token en una cookie httpOnly y no en el cuerpo', async () => {
    const respuesta = await post('/auth/login/web/credenciales')
      .set('X-Sesion-Web', 'cookie')
      .send({ email: 'a@cmp.cl', password: 'x' })
      .expect(200);

    expect(respuesta.body).toEqual({ accessToken: 'jwt', refreshTokenExpiraEn: SESION.refreshTokenExpiraEn, rol: 'ADMIN' });
    const cookie = String(respuesta.headers['set-cookie']);
    expect(cookie).toMatch(/^cmp_sesion_web=refresh-nuevo;/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/auth/);
  });

  it('sin el header responde como antes, con el refresh token en el cuerpo y sin cookie', async () => {
    const respuesta = await post('/auth/login/web/credenciales').send({ email: 'a@cmp.cl', password: 'x' }).expect(200);

    expect(respuesta.body).toEqual(SESION);
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('el refresh web con X-Sesion-Web usa el token de la cookie', async () => {
    await post('/auth/refresh/web').set('X-Sesion-Web', 'cookie').set('Cookie', 'otra=1; cmp_sesion_web=refresh-viejo').expect(200);

    expect(refrescarWeb.execute).toHaveBeenCalledWith('refresh-viejo');
  });

  it('sin X-Sesion-Web la cookie se ignora (un formulario de otro sitio no puede usarla)', async () => {
    await post('/auth/refresh/web').set('Cookie', 'cmp_sesion_web=refresh-viejo').send({}).expect(200);

    expect(refrescarWeb.execute).toHaveBeenCalledWith(undefined);
  });

  it('una sesión guardada antes de la cookie se renueva con el token del cuerpo y pasa a la cookie', async () => {
    const respuesta = await post('/auth/refresh/web').set('X-Sesion-Web', 'cookie').send({ refreshToken: 'del-cuerpo' }).expect(200);

    expect(refrescarWeb.execute).toHaveBeenCalledWith('del-cuerpo');
    expect(String(respuesta.headers['set-cookie'])).toMatch(/^cmp_sesion_web=refresh-nuevo;/);
    expect(respuesta.body.refreshToken).toBeUndefined();
  });

  it('el logout web revoca el token de la cookie y la borra', async () => {
    const respuesta = await post('/auth/logout').set('X-Sesion-Web', 'cookie').set('Cookie', 'cmp_sesion_web=refresh-viejo').expect(204);

    expect(cerrarSesion.execute).toHaveBeenCalledWith('refresh-viejo');
    expect(String(respuesta.headers['set-cookie'])).toMatch(/^cmp_sesion_web=;.*Expires=Thu, 01 Jan 1970/);
  });

  it('el logout de la app móvil sigue usando el token del cuerpo', async () => {
    const respuesta = await post('/auth/logout').send({ refreshToken: 'del-movil' }).expect(204);

    expect(cerrarSesion.execute).toHaveBeenCalledWith('del-movil');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });
});
