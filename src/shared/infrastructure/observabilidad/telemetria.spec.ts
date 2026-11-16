import { SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { registrarExcepcion } from './telemetria';

// Las funciones del span por separado, para revisarlas sin referenciar métodos de Span
const spanFalso = () => {
  const f = { recordException: jest.fn(), setStatus: jest.fn(), setAttributes: jest.fn(), end: jest.fn() };
  return { span: f as unknown as Span, f };
};

describe('registrarExcepcion', () => {
  it('dentro de una request la asocia a ella (queda en su detalle, con el usuario)', () => {
    const { span, f } = spanFalso();
    const startActiveSpan = jest.fn();
    const error = new Error('falló la consulta');

    registrarExcepcion(error, 'ExceptionsHandler', { spanActivo: span, tracer: { startActiveSpan } as unknown as Tracer });

    expect(f.recordException).toHaveBeenCalledWith(error);
    expect(f.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: 'falló la consulta' });
    expect(f.setAttributes).toHaveBeenCalledWith({ 'error.contexto': 'ExceptionsHandler' });
    expect(f.end).not.toHaveBeenCalled();
    expect(startActiveSpan).not.toHaveBeenCalled();
  });

  it('fuera de una request (un scheduler) crea una operación propia con el contexto como nombre y la cierra', () => {
    const { span, f } = spanFalso();
    const startActiveSpan = jest.fn((_nombre: string, fn: (s: Span) => void) => fn(span));
    const error = new Error('Error al cerrar turnos excedidos');

    registrarExcepcion(error, 'CierreAutomaticoTurnosScheduler', { spanActivo: undefined, tracer: { startActiveSpan } as unknown as Tracer });

    expect(startActiveSpan.mock.calls[0][0]).toBe('Error en CierreAutomaticoTurnosScheduler');
    expect(f.recordException).toHaveBeenCalledWith(error);
    expect(f.end).toHaveBeenCalled();
  });

  it('sin Application Insights configurado no falla (la API de OpenTelemetry no hace nada)', () => {
    expect(() => registrarExcepcion(new Error('x'), undefined)).not.toThrow();
  });
});
