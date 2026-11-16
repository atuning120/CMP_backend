import { SpanStatusCode, trace, type Span, type Tracer } from '@opentelemetry/api';

/*
 * Registra una excepción en Application Insights (tabla exceptions). Si hay una request en curso, queda asociada a
 * ella (se ve en su detalle, con el usuario); si no (un scheduler, el arranque), va en una operación propia con el
 * contexto como nombre. Sin Application Insights configurado, la API de OpenTelemetry no hace nada.
 */

export interface DependenciasTelemetria {
  spanActivo: Span | undefined;
  tracer: Tracer;
}

const dependencias = (): DependenciasTelemetria => ({ spanActivo: trace.getActiveSpan(), tracer: trace.getTracer('cmp-backend') });

export function registrarExcepcion(error: Error, contexto: string | undefined, { spanActivo, tracer }: DependenciasTelemetria = dependencias()): void {
  const atributos = { 'error.contexto': contexto ?? 'sin contexto' };
  const marcar = (span: Span) => {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.setAttributes(atributos);
  };
  if (spanActivo) {
    marcar(spanActivo);
    return;
  }
  tracer.startActiveSpan(`Error en ${atributos['error.contexto']}`, (span) => {
    marcar(span);
    span.end();
  });
}
