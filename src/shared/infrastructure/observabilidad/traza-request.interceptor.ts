import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { trace, type Span } from '@opentelemetry/api';
import type { Observable } from 'rxjs';

/*
 * Completa la traza de la request en Application Insights. La instrumentación HTTP no conoce las rutas de Nest y la
 * nombraría solo "GET": aquí recibe el patrón ("GET /maquinas/:id") para agrupar, más el id de usuario y su rol (del
 * JWT ya validado por el guard, que corre antes que los interceptores). Con el id se cruza con el registro de
 * requests de Log Analytics. Nada más del usuario.
 */

export interface RequestNest {
  method: string;
  baseUrl?: string;
  route?: { path?: unknown };
  user?: { idUsuario?: number; rol?: string };
}

// También la usa FiltroExcepciones: cuando un guard rechaza (401, 403) el interceptor no alcanza a correr
export function completarTraza(span: Span | undefined, request: RequestNest): void {
  if (!span) return;
  if (typeof request.route?.path === 'string') {
    const ruta = `${request.baseUrl ?? ''}${request.route.path}`;
    span.setAttribute('http.route', ruta);
    span.updateName(`${request.method} ${ruta}`);
  }
  if (request.user?.idUsuario !== undefined) span.setAttribute('enduser.id', String(request.user.idUsuario));
  if (request.user?.rol) span.setAttribute('usuario.rol', request.user.rol);
}

@Injectable()
export class TrazaRequestInterceptor implements NestInterceptor {
  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    if (contexto.getType() === 'http') completarTraza(trace.getActiveSpan(), contexto.switchToHttp().getRequest<RequestNest>());
    return siguiente.handle();
  }
}
