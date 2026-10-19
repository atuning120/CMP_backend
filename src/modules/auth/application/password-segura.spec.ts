import * as bcrypt from 'bcryptjs';
import { exigirPasswordSegura, passwordCorrecta } from './password-segura';

const codigoDe = (fn: () => unknown) => {
  try {
    fn();
  } catch (error: any) {
    return error.getResponse().code;
  }
  throw new Error('Se esperaba un error');
};

describe('exigirPasswordSegura', () => {
  it('acepta una contraseña de 8 caracteres o más', () => {
    expect(exigirPasswordSegura('Secreta1')).toBe('Secreta1');
  });

  it.each([
    ['corta', '12345'],
    ['de solo espacios', '          '],
    ['de más de 72 bytes', 'ñ'.repeat(40)],
    ['que no es texto', 12345678],
  ])('rechaza una contraseña %s', (_caso, password) => {
    expect(codigoDe(() => exigirPasswordSegura(password))).toBe('PASSWORD_DEBIL');
  });
});

describe('passwordCorrecta', () => {
  const hash = bcrypt.hashSync('Secreta123', 4);

  it('valida la contraseña contra el hash de la cuenta', async () => {
    expect(await passwordCorrecta('Secreta123', hash)).toBe(true);
    expect(await passwordCorrecta('otra', hash)).toBe(false);
  });

  // Un bcrypt de costo 10 tarda decenas de ms: si no se calculara, la respuesta sería inmediata
  it('sin cuenta o sin contraseña igual calcula bcrypt y responde false', async () => {
    for (const sinHash of [null, undefined, '']) {
      const inicio = performance.now();
      expect(await passwordCorrecta('Secreta123', sinHash)).toBe(false);
      expect(performance.now() - inicio).toBeGreaterThan(10);
    }
  });
});
