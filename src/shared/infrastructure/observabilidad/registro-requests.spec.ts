import { type CanActivate, Controller, type ExecutionContext, Get, Param, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarHttp } from '../config/http';
import type { LineaRequest } from './registro-requests';

// Hace de JwtAuthGuard: deja en req.user lo mismo que JwtStrategy.validate
class UsuarioDePrueba implements CanActivate {
  canActivate(contexto: ExecutionContext) {
    contexto.switchToHttp().getRequest().user = { idUsuario: 12, rol: 'OPERADOR', idOperador: 7 };
    return true;
  }
}

@Controller()
class PruebaController {
  @Get('health')
  salud() {
    return { status: 'ok' };
  }

  @Get('publica')
  publica() {
    return { ok: true };
  }

  @Get('maquinas/:id')
  @UseGuards(UsuarioDePrueba)
  maquina(@Param('id') id: string) {
    return { id };
  }

  @Get('falla')
  @UseGuards(UsuarioDePrueba)
  falla() {
    throw new ServiceUnavailableException('Servicio no disponible');
  }

  @Get('lenta')
  async lenta() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { ok: true };
  }
}

describe('registro de requests', () => {
  let app: NestExpressApplication;
  const registro = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const lineas = (): LineaRequest[] => [...registro.log.mock.calls, ...registro.warn.mock.calls, ...registro.error.mock.calls].map((c) => c[0]);
  // La línea se escribe en el evento 'close' de la respuesta, que puede llegar justo después que supertest termine
  const esperarRegistro = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [PruebaController] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    configurarHttp(app, 'https://panel.ejemplo.io', registro);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registra la ruta como patrón, el status, la duración y el usuario del JWT', async () => {
    await request(app.getHttpServer()).get('/maquinas/5').expect(200);
    await esperarRegistro();

    expect(registro.log).toHaveBeenCalledTimes(1);
    expect(registro.log.mock.calls[0][0]).toEqual({
      evento: 'request',
      metodo: 'GET',
      ruta: '/maquinas/:id',
      status: 200,
      ms: expect.any(Number),
      idUsuario: 12,
      rol: 'OPERADOR',
    });
  });

  it('nunca registra la query string ni los headers', async () => {
    await request(app.getHttpServer()).get('/maquinas/5?token=secreto&rut=11111111-1').set('Authorization', 'Bearer secreto').expect(200);
    await esperarRegistro();

    expect(JSON.stringify(lineas())).not.toMatch(/secreto|11111111|token|Bearer/);
  });

  it('sin sesión registra el usuario como null', async () => {
    await request(app.getHttpServer()).get('/publica').expect(200);
    await esperarRegistro();

    expect(registro.log.mock.calls[0][0]).toMatchObject({ ruta: '/publica', idUsuario: null, rol: null });
  });

  it('un 5xx va como error y un 4xx como warn', async () => {
    await request(app.getHttpServer()).get('/falla').expect(503);
    await request(app.getHttpServer()).get('/no-existe/123').expect(404);
    await esperarRegistro();

    expect(registro.error.mock.calls[0][0]).toMatchObject({ ruta: '/falla', status: 503, idUsuario: 12 });
    // Sin ruta que calce se registra la pedida (sin query)
    expect(registro.warn.mock.calls[0][0]).toMatchObject({ ruta: '/no-existe/123', status: 404, idUsuario: null });
    expect(registro.log).not.toHaveBeenCalled();
  });

  it('marca como abortada la request que el cliente cortó (p. ej. timeout del teléfono)', async () => {
    await expect(request(app.getHttpServer()).get('/lenta').timeout(50)).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(registro.warn.mock.calls[0][0]).toMatchObject({ ruta: '/lenta', abortada: true });
  });

  it('omite el health probe y los preflight CORS', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer())
      .options('/maquinas/5')
      .set('Origin', 'https://panel.ejemplo.io')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    await esperarRegistro();

    expect(lineas()).toEqual([]);
  });
});
