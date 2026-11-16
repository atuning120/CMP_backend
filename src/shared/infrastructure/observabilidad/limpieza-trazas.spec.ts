import { SpanKind } from '@opentelemetry/api';
import { LimpiezaDeTrazas, limpiarAtributos } from './limpieza-trazas';

describe('limpieza de trazas', () => {
  it('quita la query string de las URL en todas las convenciones de nombres', () => {
    const atributos: Record<string, unknown> = {
      'http.url': 'https://api/tracking/maquinas/5/recorrido?desde=2026-11-16&hasta=2026-11-17',
      'url.full': 'https://api/historial?rut=11111111-1',
      'http.target': '/historial?rut=11111111-1',
      'url.query': 'rut=11111111-1',
      'url.path': '/historial',
      'http.method': 'GET',
    };
    limpiarAtributos(atributos, true);

    expect(atributos).toEqual({
      'http.url': 'https://api/tracking/maquinas/5/recorrido',
      'url.full': 'https://api/historial',
      'http.target': '/historial',
      'url.path': '/historial',
      'http.method': 'GET',
    });
    expect(JSON.stringify(atributos)).not.toContain('11111111');
  });

  it('quita la IP del cliente de las requests entrantes', () => {
    const atributos: Record<string, unknown> = { 'http.client_ip': '200.1.2.3', 'client.address': '200.1.2.3', 'net.peer.ip': '10.0.0.1', 'http.status_code': 200 };
    limpiarAtributos(atributos, true);
    expect(atributos).toEqual({ 'http.status_code': 200 });
  });

  it('en las dependencias (PostgreSQL, Blob) conserva a qué servidor se conectó', () => {
    const atributos: Record<string, unknown> = { 'net.peer.name': 'cmp-postgres.postgres.database.azure.com', 'net.peer.ip': '20.1.2.3' };
    limpiarAtributos(atributos, false);
    expect(atributos).toEqual({ 'net.peer.name': 'cmp-postgres.postgres.database.azure.com', 'net.peer.ip': '20.1.2.3' });
  });

  it('el procesador limpia cada span al terminar', () => {
    const span = { kind: SpanKind.SERVER, attributes: { 'http.target': '/maquinas?q=CF', 'client.address': '1.2.3.4' } as Record<string, unknown> };
    new LimpiezaDeTrazas().onEnd(span);
    expect(span.attributes).toEqual({ 'http.target': '/maquinas' });
  });
});
