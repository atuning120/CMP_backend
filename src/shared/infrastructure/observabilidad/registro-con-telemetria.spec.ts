import { Logger } from '@nestjs/common';
import { RegistroConTelemetria, reportarError, separarError } from './registro-con-telemetria';

const STACK = 'TypeError: no se pudo leer\n    at revisar (cierre.js:10:5)\n    at listOnTimeout (node:internal/timers:1:1)';

describe('separarError', () => {
  it('lee contexto y stack como los entrega new Logger(contexto).error', () => {
    expect(separarError([STACK, 'CierreAutomaticoTurnosScheduler'])).toEqual({ stack: STACK, contexto: 'CierreAutomaticoTurnosScheduler' });
    expect(separarError([undefined, 'RolesGuard'])).toEqual({ stack: undefined, contexto: 'RolesGuard' });
  });

  it('sin contexto: solo el stack o nada', () => {
    expect(separarError([STACK])).toEqual({ stack: STACK });
    expect(separarError(['RolesGuard'])).toEqual({ contexto: 'RolesGuard' });
    expect(separarError([])).toEqual({});
  });
});

describe('reportarError', () => {
  const registrar = jest.fn();
  beforeEach(() => registrar.mockClear());

  it('registra el error de un scheduler con el mensaje del log, el error original y su stack', () => {
    reportarError('Error al cerrar turnos excedidos', [STACK, 'CierreAutomaticoTurnosScheduler'], registrar);

    const [error, contexto] = registrar.mock.calls[0];
    expect(error.message).toBe('Error al cerrar turnos excedidos (TypeError: no se pudo leer)');
    expect(error.stack).toBe(STACK);
    expect(contexto).toBe('CierreAutomaticoTurnosScheduler');
  });

  it('registra un error sin stack (p. ej. una ruta sin @Roles)', () => {
    reportarError('Ruta sin @Roles: X.y. Se rechaza', [undefined, 'RolesGuard'], registrar);
    expect(registrar.mock.calls[0][0].message).toBe('Ruta sin @Roles: X.y. Se rechaza');
  });

  it('un Error como mensaje se registra tal cual', () => {
    const original = new RangeError('fuera de rango');
    reportarError(original, ['Contexto'], registrar);
    expect(registrar.mock.calls[0][0]).toBe(original);
  });

  it('no duplica lo que ya registra FiltroExcepciones ni la línea 5xx del registro de requests', () => {
    reportarError('Error interno', [STACK, 'ExceptionsHandler'], registrar);
    reportarError({ evento: 'request', status: 500 }, ['Http'], registrar);
    expect(registrar).not.toHaveBeenCalled();
  });
});

describe('RegistroConTelemetria', () => {
  it('sigue escribiendo el log como siempre', () => {
    const escribir = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    Logger.overrideLogger(new RegistroConTelemetria({ json: true, colors: false }));
    try {
      new Logger('Prueba').error('falló algo', STACK);
      const linea = JSON.parse(String(escribir.mock.calls.at(-1)?.[0]));
      expect(linea).toMatchObject({ level: 'error', message: 'falló algo', context: 'Prueba', stack: STACK });
    } finally {
      Logger.overrideLogger(new Logger());
      escribir.mockRestore();
    }
  });
});
