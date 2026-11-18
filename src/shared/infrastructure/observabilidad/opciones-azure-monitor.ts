import type { AzureMonitorOpenTelemetryOptions } from '@azure/monitor-opentelemetry';
import type { IncomingMessage, RequestOptions } from 'node:http';
import { LimpiezaDeTrazas } from './limpieza-trazas';

/*
 * Configuración de Application Insights (recurso cmp-appinsights, Chile Central). Sin imports de Nest ni de módulos
 * instrumentados: instrument.ts la carga antes que todo lo demás, porque OpenTelemetry solo instrumenta (http, pg,
 * Azure SDK) lo que se carga después de useAzureMonitor.
 *
 * Qué se envía: requests (con la ruta como patrón, el id de usuario y su rol, ver traza-request.interceptor.ts),
 * dependencias (PostgreSQL con la consulta parametrizada, sin valores; Azure Blob; Metabase) y excepciones. Los logs NO:
 * ya llegan a Log Analytics por la salida estándar del contenedor. Nada de query strings ni IP (limpieza-trazas.ts).
 */

// Ruido que gastaría cuota sin aportar: el probe de Azure, los preflight CORS, las posiciones del adaptador (cada ~30 s
// por máquina) y el polling de Socket.IO
export function ignorarRequest(metodo: string | undefined, url: string | undefined): boolean {
  const ruta = (url ?? '').split('?')[0];
  return (
    metodo === 'OPTIONS' ||
    ruta === '/health' ||
    ruta.startsWith('/health/') ||
    ruta.startsWith('/socket.io') ||
    (metodo === 'POST' && ruta === '/tracking/posiciones')
  );
}

// Las llamadas del propio SDK no son dependencias de la aplicación: su configuración remota en Azure Monitor y el
// servicio de metadatos de las VM de Azure (169.254.169.254), que consulta al arrancar para identificar el servidor.
// En Container Apps ese servicio no existe: la conexión rechazada aparecía como excepción en cada reinicio
const IP_METADATOS_AZURE = '169.254.169.254';

export function ignorarLlamadaSaliente(host: string | null | undefined): boolean {
  const nombre = (host ?? '').split(':')[0];
  return nombre === IP_METADATOS_AZURE || /(^|\.)(monitor\.azure\.com|applicationinsights\.azure\.com)$/i.test(nombre);
}

// Nombre y versión con que el Backend aparece en Application Insights (cloud_RoleName y la versión de la app). Van
// por las variables estándar de OpenTelemetry, que el SDK lee al iniciar
export function atributosDelServicio(env: Record<string, string | undefined>): { OTEL_SERVICE_NAME: string; OTEL_RESOURCE_ATTRIBUTES: string } {
  const version = env.VERSION_APP || 'local';
  return {
    OTEL_SERVICE_NAME: 'cmp-backend',
    OTEL_RESOURCE_ATTRIBUTES: `service.version=${version},deployment.environment=${env.NODE_ENV === 'production' ? 'produccion' : 'local'}`,
  };
}

/** null sin APPLICATIONINSIGHTS_CONNECTION_STRING (tests, local sin configurar): no se envía nada */
export function opcionesAzureMonitor(env: Record<string, string | undefined>): AzureMonitorOpenTelemetryOptions | null {
  const connectionString = env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) return null;
  // El SDK tipa estas opciones como InstrumentationConfig genérico, pero se las pasa completas a cada instrumentación de
  // OpenTelemetry (HttpInstrumentationConfig, PgInstrumentationConfig), como muestra su README
  const http = {
    enabled: true,
    ignoreIncomingRequestHook: (request: IncomingMessage) => ignorarRequest(request.method, request.url),
    ignoreOutgoingRequestHook: (opciones: RequestOptions) => ignorarLlamadaSaliente(opciones.hostname ?? opciones.host),
  };
  // Solo las consultas de una request: las de los schedulers (cada 15-30 s) serían miles al día sin aportar. Si un
  // scheduler falla, su error llega igual por el logger (registro-con-telemetria.ts)
  const postgreSql = { enabled: true, requireParentSpan: true };
  return {
    azureMonitorExporterOptions: { connectionString },
    // Hasta 5 requests por segundo con traza completa: en el piloto es todo; si algo dispara un bucle, no se dispara el costo
    tracesPerSecond: 5,
    instrumentationOptions: {
      http,
      postgreSql,
      azureSdk: { enabled: true },
      mongoDb: { enabled: false },
      mySql: { enabled: false },
      redis: { enabled: false },
      redis4: { enabled: false },
    },
    // Vista en vivo en el portal (solo transmite mientras alguien la mira)
    enableLiveMetrics: true,
    spanProcessors: [new LimpiezaDeTrazas() as never],
  };
}
