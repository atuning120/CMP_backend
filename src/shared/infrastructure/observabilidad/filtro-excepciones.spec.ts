import { CanActivate, Controller, ExecutionContext, Get, NotFoundException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { trace, type Span } from '@opentelemetry/api';
import request from 'supertest';
import { FiltroExcepciones } from './filtro-excepciones';
import { registrarExcepcion } from './telemetria';
import { TrazaRequestInterceptor } from './traza-request.interceptor';

jest.mock('./telemetria', () => ({ registrarExcepcion: jest.fn() }));

// Hace de JwtAuthGuard: deja en req.user lo mismo que JwtStrategy.validate
class UsuarioDePrueba implements CanActivate {
  canActivate(contexto: ExecutionContext) {
    contexto.switchToHttp().getRequest().user = { idUsuario: 12, rol: 'JEFE_TURNO', idOperador: null };
    return true;
  }
}

// Hace de JwtAuthGuard sin token: rechaza antes de que corra el interceptor
class SinSesion implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException();
  }
}

@Controller('prueba')
class PruebaController {
  @Get('falla')
  falla(): never {
    throw new Error('error no controlado de prueba');
  }

  @Get('no-existe')
  noExiste(): never {
    throw new NotFoundException('La máquina no existe.');
  }

  @Get('maquinas/:id')
  @UseGuards(UsuarioDePrueba)
  maquina() {
    return { ok: true };
  }

  @Get('perfil/:id')
  @UseGuards(SinSesion)
  perfil() {
    return { ok: true };
  }
}

describe('filtro de excepciones e interceptor de trazas (como en AppModule)', () => {
  let app: NestExpressApplication;
  const span = { setAttribute: jest.fn(), updateName: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [PruebaController],
      providers: [
        { provide: APP_FILTER, useClass: FiltroExcepciones },
        { provide: APP_INTERCEPTOR, useClass: TrazaRequestInterceptor },
      ],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // La instrumentación HTTP deja activa la traza de la request; aquí, una falsa
    jest.spyOn(trace, 'getActiveSpan').mockReturnValue(span as unknown as Span);
  });

  it('registra una excepción no controlada y responde el 500 de siempre, sin el detalle interno', async () => {
    const respuesta = await request(app.getHttpServer()).get('/prueba/falla').expect(500);

    expect(respuesta.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(registrarExcepcion).toHaveBeenCalledTimes(1);
    expect(jest.mocked(registrarExcepcion).mock.calls[0][0]).toMatchObject({ message: 'error no controlado de prueba' });
  });

  it('no registra las HttpException (un 404 es una respuesta esperada) y conserva su mensaje', async () => {
    const respuesta = await request(app.getHttpServer()).get('/prueba/no-existe').expect(404);

    expect(respuesta.body).toMatchObject({ statusCode: 404, message: 'La máquina no existe.' });
    expect(registrarExcepcion).not.toHaveBeenCalled();
  });

  it('nombra la traza con la ruta como patrón y le agrega solo el id de usuario y el rol', async () => {
    await request(app.getHttpServer()).get('/prueba/maquinas/5?filtro=x').expect(200);

    expect(span.updateName).toHaveBeenCalledWith('GET /prueba/maquinas/:id');
    expect(span.setAttribute.mock.calls).toEqual([
      ['http.route', '/prueba/maquinas/:id'],
      ['enduser.id', '12'],
      ['usuario.rol', 'JEFE_TURNO'],
    ]);
  });

  it('una request que el guard rechaza (401) igual queda con su ruta, sin usuario y sin registrarse como error', async () => {
    await request(app.getHttpServer()).get('/prueba/perfil/3').expect(401);

    expect(span.updateName).toHaveBeenCalledWith('GET /prueba/perfil/:id');
    expect(span.setAttribute.mock.calls).toEqual([['http.route', '/prueba/perfil/:id']]);
    expect(registrarExcepcion).not.toHaveBeenCalled();
  });
});
