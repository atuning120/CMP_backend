import { normalizarRut } from './rut';

describe('normalizarRut', () => {
  it.each([
    ['12345678-5', '12.345.678-5'],
    ['12.345.678-5', '12.345.678-5'],
    ['123456785', '12.345.678-5'],
    ['15123456-9', '15.123.456-9'],
    ['1.234.567-4', '1.234.567-4'],
    ['10.000.013-k', '10.000.013-K'],
  ])('acepta %p como %p', (entrada, esperado) => {
    expect(normalizarRut(entrada)).toBe(esperado);
  });

  it.each(['12.345.678-9', '1234-5', 'abc', '', null, 12345678])('rechaza %p', (entrada) => {
    expect(normalizarRut(entrada)).toBeNull();
  });
});
