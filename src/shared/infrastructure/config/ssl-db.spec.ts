import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leerSslDb } from './ssl-db';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';

describe('leerSslDb', () => {
  it('sin DB_SSL=true la conexión va sin TLS (Postgres local de docker-compose)', () => {
    expect(leerSslDb(undefined, undefined)).toBe(false);
    expect(leerSslDb('false', PEM)).toBe(false);
  });

  it('con DB_SSL=true verifica el certificado con las CAs de Node.js (Azure PG)', () => {
    expect(leerSslDb('true', undefined)).toEqual({ rejectUnauthorized: true });
    expect(leerSslDb('true', '  ')).toEqual({ rejectUnauthorized: true });
  });

  it('nunca desactiva la verificación del certificado', () => {
    expect(leerSslDb('true', PEM)).toMatchObject({ rejectUnauthorized: true });
  });

  it('acepta la CA como PEM en la variable, también con los saltos escritos como \\n', () => {
    expect(leerSslDb('true', PEM)).toEqual({ rejectUnauthorized: true, ca: PEM });
    expect(leerSslDb('true', PEM.replace(/\n/g, '\\n'))).toEqual({ rejectUnauthorized: true, ca: PEM });
  });

  it('acepta la CA como ruta a un archivo PEM (ca.pem de Aiven)', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'ssl-db-'));
    try {
      const archivo = join(carpeta, 'ca.pem');
      writeFileSync(archivo, PEM);
      expect(leerSslDb('true', archivo)).toEqual({ rejectUnauthorized: true, ca: PEM });
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it('falla al arrancar si la ruta de la CA no existe (mejor que conectar sin verificar)', () => {
    expect(() => leerSslDb('true', '/no/existe/ca.pem')).toThrow();
  });
});
