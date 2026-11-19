import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ConexionReportes, opcionesBaseReportes } from './conexion-reportes';

const leerDe = (valores: Record<string, string>) => (clave: string) => valores[clave];

const AIVEN = {
  REPORTES_DB_HOST: 'pg-dev.aivencloud.com',
  REPORTES_DB_PORT: '12345',
  REPORTES_DB_USER: 'avnadmin',
  REPORTES_DB_PASSWORD: 'clave',
  REPORTES_DB_NAME: 'defaultdb',
  REPORTES_DB_SSL: 'true',
  REPORTES_DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nAAA\\n-----END CERTIFICATE-----',
};

describe('opcionesBaseReportes', () => {
  it('sin REPORTES_DB_HOST no hay base separada', () => {
    expect(opcionesBaseReportes(leerDe({}))).toBeNull();
    expect(opcionesBaseReportes(leerDe({ REPORTES_DB_HOST: '  ' }))).toBeNull();
  });

  it('arma la conexión con TLS verificado y la CA en una línea', () => {
    expect(opcionesBaseReportes(leerDe(AIVEN))).toEqual(
      expect.objectContaining({
        type: 'postgres',
        host: 'pg-dev.aivencloud.com',
        port: 12345,
        username: 'avnadmin',
        password: 'clave',
        database: 'defaultdb',
        ssl: { rejectUnauthorized: true, ca: '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----' },
        synchronize: false,
      }),
    );
    expect(opcionesBaseReportes(leerDe({ ...AIVEN, REPORTES_DB_PORT: '' }))).toEqual(expect.objectContaining({ port: 5432 }));
  });

  it('a medio configurar falla en vez de escribir en la base principal', () => {
    expect(() => opcionesBaseReportes(leerDe({ REPORTES_DB_HOST: 'pg-dev', REPORTES_DB_USER: 'u' }))).toThrow(
      'faltan REPORTES_DB_PASSWORD, REPORTES_DB_NAME',
    );
    expect(() => opcionesBaseReportes(leerDe({ ...AIVEN, REPORTES_DB_PORT: 'abc' }))).toThrow('REPORTES_DB_PORT');
  });
});

describe('ConexionReportes', () => {
  const principal = { soy: 'principal' } as unknown as DataSource;
  const config = (valores: Record<string, string>) => ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('sin base separada usa la principal', async () => {
    const conexion = new ConexionReportes(principal, config({}));
    expect(conexion.separada).toBe(false);
    await expect(conexion.dataSource()).resolves.toBe(principal);
  });

  it('con base separada se conecta en el primer uso, una sola vez, y reintenta si falló', async () => {
    const initialize = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockRejectedValueOnce(new Error('Aiven no responde'))
      .mockImplementation(async function (this: DataSource) {
        return this;
      });
    const conexion = new ConexionReportes(principal, config(AIVEN));
    expect(conexion.separada).toBe(true);
    expect(initialize).not.toHaveBeenCalled();

    await expect(conexion.dataSource()).rejects.toThrow('Aiven no responde');
    const propia = await conexion.dataSource();
    expect(propia).not.toBe(principal);
    expect(propia.options).toEqual(expect.objectContaining({ host: 'pg-dev.aivencloud.com', database: 'defaultdb' }));
    await expect(conexion.dataSource()).resolves.toBe(propia);
    expect(initialize).toHaveBeenCalledTimes(2);
  });
});
