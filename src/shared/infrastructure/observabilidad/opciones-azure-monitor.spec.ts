import type { IncomingMessage, RequestOptions } from 'node:http';
import { LimpiezaDeTrazas } from './limpieza-trazas';
import { atributosDelServicio, ignorarLlamadaSaliente, ignorarRequest, opcionesAzureMonitor } from './opciones-azure-monitor';

const CONEXION = 'InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://ejemplo.in.applicationinsights.azure.com/';

describe('opciones de Application Insights', () => {
  it('sin connection string queda inactivo (tests y local sin configurar)', () => {
    expect(opcionesAzureMonitor({})).toBeNull();
    expect(opcionesAzureMonitor({ APPLICATIONINSIGHTS_CONNECTION_STRING: '' })).toBeNull();
  });

  it('con connection string limita las trazas por segundo, limpia los datos y no usa instrumentaciones que no aplican', () => {
    const opciones = opcionesAzureMonitor({ APPLICATIONINSIGHTS_CONNECTION_STRING: CONEXION })!;

    expect(opciones.azureMonitorExporterOptions).toEqual({ connectionString: CONEXION });
    expect(opciones.tracesPerSecond).toBe(5);
    expect(opciones.spanProcessors?.[0]).toBeInstanceOf(LimpiezaDeTrazas);
    expect(opciones.instrumentationOptions).toMatchObject({
      http: { enabled: true },
      // Solo las consultas dentro de una request, no las de los schedulers
      postgreSql: { enabled: true, requireParentSpan: true },
      azureSdk: { enabled: true },
      mongoDb: { enabled: false },
      mySql: { enabled: false },
      redis: { enabled: false },
      redis4: { enabled: false },
    });
  });

  it('la instrumentación HTTP usa los filtros de requests entrantes y llamadas salientes', () => {
    const http = opcionesAzureMonitor({ APPLICATIONINSIGHTS_CONNECTION_STRING: CONEXION })!.instrumentationOptions!.http as {
      ignoreIncomingRequestHook: (request: IncomingMessage) => boolean;
      ignoreOutgoingRequestHook: (opciones: RequestOptions) => boolean;
    };
    expect(http.ignoreIncomingRequestHook({ method: 'GET', url: '/health' } as IncomingMessage)).toBe(true);
    expect(http.ignoreIncomingRequestHook({ method: 'GET', url: '/maquinas/flota' } as IncomingMessage)).toBe(false);
    expect(http.ignoreOutgoingRequestHook({ hostname: 'settings.sdk.monitor.azure.com' })).toBe(true);
    expect(http.ignoreOutgoingRequestHook({ host: 'cmp-metabase.blueglacier-678ef622.chilecentral.azurecontainerapps.io' })).toBe(false);
  });

  it.each([
    ['settings.sdk.monitor.azure.com', true],
    ['chilecentral.livediagnostics.monitor.azure.com', true],
    ['chilecentral-0.in.applicationinsights.azure.com', true],
    // Servicio de metadatos de las VM de Azure: en Container Apps la conexión se rechaza (era una excepción falsa)
    ['169.254.169.254', true],
    ['169.254.169.254:80', true],
    ['settings.sdk.monitor.azure.com:443', true],
    ['cmpevidencias2026.blob.core.windows.net', false],
    ['notmonitor.azure.com.ejemplo.cl', false],
    [undefined, false],
  ])('la llamada saliente a %s se ignora: %p', (host, ignorada) => {
    expect(ignorarLlamadaSaliente(host)).toBe(ignorada);
  });

  it.each([
    ['GET', '/health', true],
    ['GET', '/health/', true],
    ['OPTIONS', '/maquinas', true],
    ['GET', '/socket.io/?EIO=4&transport=polling', true],
    ['POST', '/tracking/posiciones', true],
    ['POST', '/tracking/posiciones?x=1', true],
    ['GET', '/tracking/turnos/5/recorrido', false],
    ['GET', '/healthy', false],
    ['POST', '/turnos/estados', false],
  ])('%s %s se ignora: %p', (metodo, url, ignorada) => {
    expect(ignorarRequest(metodo, url)).toBe(ignorada);
  });

  it('identifica al servicio, su versión (el commit de la imagen) y el ambiente', () => {
    expect(atributosDelServicio({ NODE_ENV: 'production', VERSION_APP: 'abc123' })).toEqual({
      OTEL_SERVICE_NAME: 'cmp-backend',
      OTEL_RESOURCE_ATTRIBUTES: 'service.version=abc123,deployment.environment=produccion',
    });
    // El Dockerfile deja VERSION_APP vacío cuando la imagen se construye sin el commit
    expect(atributosDelServicio({ VERSION_APP: '' }).OTEL_RESOURCE_ATTRIBUTES).toBe('service.version=local,deployment.environment=local');
  });
});
