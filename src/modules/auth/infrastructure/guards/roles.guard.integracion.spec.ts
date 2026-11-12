import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { VerificadorSesionService } from '../../application/services/verificador-sesion.service';
import { ZonaController } from '../../../geocercas/interface/http/controllers/zona.controller';
import { UsuarioController } from '../../../usuarios/interface/http/controllers/usuario.controller';

/**
 * RolesGuard dentro de Nest, con JwtAuthGuard y tokens reales: que Nest le inyecte el Reflector, que corra después
 * del JWT y que las respuestas sean las que esperan los clientes (401 = sesión vencida, 403 = sin permiso).
 */
const SECRETO = 'secreto-de-prueba-del-guard-de-roles';
// El usuario 99 fue desactivado después de recibir su token (que sigue sin vencer)
const DESACTIVADO = 99;
const token = (rol: string, sub = 1) => `Bearer ${sign({ sub, rol }, SECRETO, { expiresIn: '5m' })}`;

describe('RolesGuard en una aplicación Nest', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ZonaController, UsuarioController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => SECRETO } },
        { provide: VerificadorSesionService, useValue: { vigente: ({ sub }: { sub: number }) => Promise.resolve(sub !== DESACTIVADO) } },
      ],
    })
      // Los use cases no importan aquí: solo responden algo si el guard deja pasar
      .useMocker(() => ({ execute: () => Promise.resolve([]), todas: () => Promise.resolve([]) }))
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['ADMIN', 'JEFE_TURNO', 'VISOR', 'OPERADOR'])('GET /zonas (todos los roles) deja pasar a %s', async (rol) => {
    await request(app.getHttpServer()).get('/zonas').set('Authorization', token(rol)).expect(200);
  });

  it('GET /usuarios deja pasar al ADMIN', async () => {
    await request(app.getHttpServer()).get('/usuarios').set('Authorization', token('ADMIN')).expect(200);
  });

  it.each(['JEFE_TURNO', 'VISOR', 'OPERADOR'])('GET /usuarios rechaza a %s con 403 SIN_PERMISO', async (rol) => {
    const respuesta = await request(app.getHttpServer()).get('/usuarios').set('Authorization', token(rol)).expect(403);
    expect(respuesta.body).toMatchObject({ statusCode: 403, code: 'SIN_PERMISO' });
  });

  it('sin token o con un token inválido sigue respondiendo 401 (lo decide JwtAuthGuard antes que el rol)', async () => {
    await request(app.getHttpServer()).get('/usuarios').expect(401);
    await request(app.getHttpServer()).get('/usuarios').set('Authorization', `Bearer ${sign({ sub: 1, rol: 'ADMIN' }, 'otro-secreto')}`).expect(401);
  });

  it('un usuario desactivado recibe 401 SESION_INVALIDA aunque su token no haya vencido (el cliente renueva y el refresh lo rechaza)', async () => {
    const respuesta = await request(app.getHttpServer()).get('/zonas').set('Authorization', token('ADMIN', DESACTIVADO)).expect(401);
    expect(respuesta.body).toMatchObject({ code: 'SESION_INVALIDA' });
  });
});
