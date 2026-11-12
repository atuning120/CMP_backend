import { Controller, Get, Header } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarHttp } from './http';

const WEB = 'https://cmp-frontend.ejemplo.io';

@Controller('prueba')
class PruebaController {
  @Get()
  json() {
    return { ok: true };
  }

  @Get('archivo')
  @Header('Content-Disposition', 'attachment; filename="reporte.xlsx"')
  archivo() {
    return 'x';
  }
}

describe('configurarHttp', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [PruebaController] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarHttp(app, WEB);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('agrega los headers de seguridad de helmet y no anuncia Express', async () => {
    const respuesta = await request(app.getHttpServer()).get('/prueba').expect(200);
    expect(respuesta.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'");
    expect(respuesta.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  it('el panel web sigue pudiendo enviar la cookie de sesión y leer el nombre de los archivos', async () => {
    const respuesta = await request(app.getHttpServer()).get('/prueba/archivo').set('Origin', WEB).expect(200);
    expect(respuesta.headers['access-control-allow-origin']).toBe(WEB);
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
    expect(respuesta.headers['access-control-expose-headers']).toBe('Content-Disposition');
  });

  it('el preflight CORS del panel sigue respondiendo', async () => {
    const respuesta = await request(app.getHttpServer())
      .options('/prueba')
      .set('Origin', WEB)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-sesion-web')
      .expect(204);
    expect(respuesta.headers['access-control-allow-origin']).toBe(WEB);
  });

  it('otros orígenes (la app móvil no manda Origin) siguen aceptados sin credenciales', async () => {
    const respuesta = await request(app.getHttpServer()).get('/prueba').set('Origin', 'https://otra-app.ejemplo.io').expect(200);
    expect(respuesta.headers['access-control-allow-origin']).toBe('*');
    expect(respuesta.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
