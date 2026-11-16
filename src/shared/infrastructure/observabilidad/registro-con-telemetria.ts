import { ConsoleLogger } from '@nestjs/common';
import { registrarExcepcion } from './telemetria';

/*
 * Logger de la app (main.ts): escribe como siempre y además registra en Application Insights todo lo logueado como
 * error. Así llegan los errores que el código atrapa y solo registra (los schedulers de cierre automático y alertas,
 * Azure Blob, el admin principal, una ruta sin @Roles) sin que la aplicación dependa de Azure.
 */

// Contextos cuyo error ya se registra por otra vía: ExceptionsHandler es el log de Nest de una excepción no controlada
// (la registra FiltroExcepciones) y Http es la línea del registro de requests de esa misma respuesta 5xx
const YA_REGISTRADOS = new Set(['ExceptionsHandler', 'Http']);

const PARECE_STACK = /\n\s+at /;

/**
 * Los parámetros que llegan a ConsoleLogger.error después del mensaje. `new Logger('Ctx').error(msg, stack?)` entrega
 * [stack | undefined, 'Ctx']; sin contexto pueden ser [] o [stack].
 */
export function separarError(parametros: unknown[]): { contexto?: string; stack?: string } {
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : undefined);
  if (parametros.length === 0) return {};
  if (parametros.length === 1) {
    const unico = texto(parametros[0]);
    return unico && PARECE_STACK.test(unico) ? { stack: unico } : { contexto: unico };
  }
  return { contexto: texto(parametros.at(-1)), stack: texto(parametros[0]) };
}

type Registrar = (error: Error, contexto: string | undefined) => void;

export function reportarError(mensaje: unknown, parametros: unknown[], registrar: Registrar = registrarExcepcion): void {
  const { contexto, stack } = separarError(parametros);
  if (contexto && YA_REGISTRADOS.has(contexto)) return;

  let error: Error;
  if (mensaje instanceof Error) {
    error = mensaje;
  } else {
    // El mensaje del log y, si vino el stack, la primera línea del error original (el tipo y su mensaje)
    const original = stack?.split('\n')[0];
    const texto = typeof mensaje === 'string' ? mensaje : JSON.stringify(mensaje);
    error = new Error(original && !texto.includes(original) ? `${texto} (${original})` : texto);
    if (stack) error.stack = stack;
  }
  registrar(error, contexto);
}

export class RegistroConTelemetria extends ConsoleLogger {
  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    reportarError(message, optionalParams);
  }
}
