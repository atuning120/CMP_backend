import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { FirmadorDashboardMetabase } from './firmador-dashboard.metabase';

const SECRETO = 'clave-de-incrustacion-de-prueba-0123456789abcdef';

const firmador = (variables: Record<string, string>) => new FirmadorDashboardMetabase(new ConfigService(variables));

describe('FirmadorDashboardMetabase', () => {
  const ahora = new Date('2026-07-02T15:00:00.000Z');
  const configurado = {
    METABASE_SITE_URL: 'https://cmp-metabase.example.io/',
    METABASE_SECRET_KEY: SECRETO,
    METABASE_DASHBOARD_OPERACION: '2',
    METABASE_DASHBOARD_ESTADO_PAGO: '5',
  };

  it('firma el dashboard pedido con sus filtros bloqueados y una hora de vigencia', () => {
    const embebido = firmador(configurado).firmar('ESTADO_PAGO', { id_carga: 7 }, ahora);
    expect(embebido?.expiraEn).toEqual(new Date('2026-07-02T16:00:00.000Z'));

    const [base, hash] = embebido!.url.split('#');
    expect(hash).toBe('bordered=false&titled=false');
    expect(base.startsWith('https://cmp-metabase.example.io/embed/dashboard/')).toBe(true);
    const token = base.split('/').pop()!;
    expect(jwt.verify(token, SECRETO, { clockTimestamp: ahora.getTime() / 1000 })).toEqual({
      resource: { dashboard: 5 },
      params: { id_carga: 7 },
      iat: Math.floor(ahora.getTime() / 1000),
      exp: Math.floor(new Date('2026-07-02T16:00:00.000Z').getTime() / 1000),
    });
  });

  it('null si falta la URL, la clave o el id del dashboard', () => {
    expect(firmador({ ...configurado, METABASE_SECRET_KEY: '' }).firmar('OPERACION', {}, ahora)).toBeNull();
    expect(firmador({ ...configurado, METABASE_SITE_URL: '' }).firmar('OPERACION', {}, ahora)).toBeNull();
    expect(firmador({ ...configurado, METABASE_DASHBOARD_OPERACION: 'abc' }).firmar('OPERACION', {}, ahora)).toBeNull();
    expect(firmador({ ...configurado, METABASE_DASHBOARD_ESTADO_PAGO: '' }).firmar('ESTADO_PAGO', {}, ahora)).toBeNull();
  });

  describe('disponible', () => {
    const responder = (respuesta: Promise<Response>) => jest.spyOn(globalThis, 'fetch').mockReturnValueOnce(respuesta);
    afterEach(() => jest.restoreAllMocks());

    it('true solo si /api/health responde status ok', async () => {
      const espia = responder(Promise.resolve(Response.json({ status: 'ok' })));
      await expect(firmador(configurado).disponible()).resolves.toBe(true);
      expect(espia.mock.calls[0][0]).toBe('https://cmp-metabase.example.io/api/health');

      responder(Promise.resolve(Response.json({ status: 'starting' })));
      await expect(firmador(configurado).disponible()).resolves.toBe(false);
      responder(Promise.resolve(Response.json({ error: 'Failed to forward request' }, { status: 502 })));
      await expect(firmador(configurado).disponible()).resolves.toBe(false);
      responder(Promise.reject(new Error('timeout')));
      await expect(firmador(configurado).disponible()).resolves.toBe(false);
    });
  });
});
