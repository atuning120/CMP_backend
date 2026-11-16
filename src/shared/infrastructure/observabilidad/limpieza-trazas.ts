import { SpanKind } from '@opentelemetry/api';

/*
 * Quita de las trazas, antes de enviarlas a Application Insights, lo que no debe salir del Backend: la query string de
 * las URL (puede llevar fechas de búsqueda, ids o tokens de enlaces) y la IP del cliente en las requests entrantes
 * (Application Insights la enmascara al recibirla, pero no se envía). Revisa todas las convenciones de nombres de
 * OpenTelemetry (http.url / url.full, http.target / url.query, client.address, net.peer.ip...), porque cambian entre
 * versiones de la instrumentación HTTP.
 */

const CON_URL = /url|target/i;
const IP_DEL_CLIENTE = /client_ip|client\.address|peer\.ip|peer\.address|sock\.peer/i;

export function limpiarAtributos(atributos: Record<string, unknown>, esRequestEntrante: boolean): void {
  for (const clave of Object.keys(atributos)) {
    const valor = atributos[clave];
    if (clave === 'url.query' || (esRequestEntrante && IP_DEL_CLIENTE.test(clave))) {
      delete atributos[clave];
    } else if (typeof valor === 'string' && CON_URL.test(clave) && valor.includes('?')) {
      atributos[clave] = valor.slice(0, valor.indexOf('?'));
    }
  }
}

// Lo mínimo de un span terminado que se usa aquí (ReadableSpan de @opentelemetry/sdk-trace-base)
interface SpanTerminado {
  kind: SpanKind;
  attributes: Record<string, unknown>;
}

// Procesador que se registra en useAzureMonitor (spanProcessors); corre al terminar cada span, antes del envío
export class LimpiezaDeTrazas {
  onStart(): void {}

  onEnd(span: SpanTerminado): void {
    limpiarAtributos(span.attributes, span.kind === SpanKind.SERVER);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
