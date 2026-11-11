import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ValidacionTiposPipe } from './validacion-tipos.pipe';
import { LoginRequestDto } from '../../../modules/auth/interface/http/dtos/login.request.dto';
import { RefreshTokenRequestDto } from '../../../modules/auth/interface/http/dtos/refresh-token.request.dto';

// DTO aún sin decoradores (como la mayoría de los del API): debe pasar intacto
class DtoSinDecoradores {
  idMaquina: number;
}

const cuerpo = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({ type: 'body', metatype });

const errorDe = async (promesa: Promise<unknown>) => {
  try {
    await promesa;
  } catch (error) {
    return error as BadRequestException;
  }
  throw new Error('Se esperaba un error de validación');
};

describe('ValidacionTiposPipe', () => {
  const pipe = new ValidacionTiposPipe();

  it('deja pasar el mismo cuerpo, sin recortar ni convertir campos', async () => {
    const body = { rut: '12.345.678-9', password: 'secreta123', otroCampo: 1 };
    await expect(pipe.transform(body, cuerpo(LoginRequestDto))).resolves.toBe(body);
  });

  it('deja que el use case decida si faltan datos', async () => {
    await expect(pipe.transform({}, cuerpo(LoginRequestDto))).resolves.toEqual({});
  });

  it('acepta null en un campo opcional (sesiones web guardadas antes de la cookie)', async () => {
    await expect(pipe.transform({ refreshToken: null }, cuerpo(RefreshTokenRequestDto))).resolves.toEqual({ refreshToken: null });
  });

  it.each([
    ['un número', { email: 123, password: 'secreta123' }, ['email']],
    ['un objeto', { email: 'a@cmp.cl', password: { $ne: null } }, ['password']],
    ['un arreglo', { rut: ['1'], password: 'x' }, ['rut']],
  ])('rechaza %s donde va un string con 400 DATOS_INVALIDOS', async (_caso, body, campos) => {
    const error = await errorDe(pipe.transform(body, cuerpo(LoginRequestDto)));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual({
      statusCode: 400,
      code: 'DATOS_INVALIDOS',
      message: 'Los datos enviados no tienen el formato esperado',
      campos,
    });
  });

  it('no incluye los valores en la respuesta (pueden ser contraseñas)', async () => {
    const error = await errorDe(pipe.transform({ password: { secreto: 'clave-filtrada' } }, cuerpo(LoginRequestDto)));
    expect(JSON.stringify(error.getResponse())).not.toContain('clave-filtrada');
  });

  it('deja pasar intacto un DTO sin decoradores', async () => {
    const body = { idMaquina: 'no-es-numero', extra: true };
    await expect(pipe.transform(body, cuerpo(DtoSinDecoradores))).resolves.toBe(body);
  });

  it('no revisa tipos inline ni import type (llegan como Object)', async () => {
    const body = { idsAreas: 'cualquier cosa' };
    await expect(pipe.transform(body, cuerpo(Object))).resolves.toBe(body);
  });

  it('solo revisa el cuerpo: query y params pasan intactos', async () => {
    const query = { email: 123 };
    await expect(pipe.transform(query, { type: 'query', metatype: LoginRequestDto })).resolves.toBe(query);
  });
});
