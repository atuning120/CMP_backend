import { leerDbPassword, leerJwtSecret } from './secretos';

describe('secretos de configuración', () => {
  const nodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('JWT_SECRET es obligatorio en cualquier entorno', () => {
    process.env.NODE_ENV = 'development';
    expect(() => leerJwtSecret(undefined)).toThrow('Falta la variable de entorno JWT_SECRET');
    expect(() => leerJwtSecret('   ')).toThrow('Falta la variable de entorno JWT_SECRET');
  });

  it('en desarrollo acepta el valor de ejemplo, en producción no', () => {
    process.env.NODE_ENV = 'development';
    expect(leerJwtSecret('super_secret_dev_key')).toBe('super_secret_dev_key');

    process.env.NODE_ENV = 'production';
    expect(() => leerJwtSecret('super_secret_dev_key')).toThrow('valor de ejemplo');
    expect(leerJwtSecret('x'.repeat(48))).toBe('x'.repeat(48));
  });

  it('DB_PASSWORD es obligatoria en producción', () => {
    process.env.NODE_ENV = 'production';
    expect(() => leerDbPassword(undefined)).toThrow('Falta la variable de entorno DB_PASSWORD');
    expect(leerDbPassword('desde-el-entorno')).toBe('desde-el-entorno');

    process.env.NODE_ENV = 'development';
    expect(leerDbPassword(undefined)).toBe('cmp_pass');
  });
});
