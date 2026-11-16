import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { trace } from '@opentelemetry/api';
import { registrarExcepcion } from './telemetria';
import { completarTraza, type RequestNest } from './traza-request.interceptor';

/*
 * Filtro global (APP_FILTER): registra en Application Insights las excepciones no controladas, asociadas a su request,
 * y responde exactamente como el filtro por defecto de Nest (500 sin detalle interno). Las HttpException (400, 404...)
 * son respuestas esperadas y no se registran como error. Además nombra la traza con su ruta: si un guard rechazó la
 * request (401, 403), el interceptor no alcanzó a hacerlo.
 */
@Catch()
export class FiltroExcepciones extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') completarTraza(trace.getActiveSpan(), host.switchToHttp().getRequest<RequestNest>());
    if (!(exception instanceof HttpException)) {
      registrarExcepcion(exception instanceof Error ? exception : new Error(String(exception)), 'ExceptionsHandler');
    }
    super.catch(exception, host);
  }
}
