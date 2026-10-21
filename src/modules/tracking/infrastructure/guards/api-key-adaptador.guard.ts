import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const resumen = (valor: string) => createHash('sha256').update(valor).digest();

/**
 * Solo el adaptador puede enviar posiciones: se identifica con la cabecera X-Api-Key, que debe coincidir con
 * ADAPTADOR_API_KEY. Se comparan los hash en tiempo constante para no filtrar la clave por el tiempo de respuesta.
 */
@Injectable()
export class ApiKeyAdaptadorGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAdaptadorGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const esperada = this.config.get<string>('ADAPTADOR_API_KEY')?.trim();
    if (!esperada) {
      // 503 y no 401: el adaptador conserva las posiciones y reintenta hasta que se configure
      this.logger.error('Falta la variable de entorno ADAPTADOR_API_KEY: no se reciben posiciones');
      throw new ServiceUnavailableException({ statusCode: 503, code: 'TRACKING_NO_CONFIGURADO', message: 'Tracking no configurado' });
    }
    const recibida = context.switchToHttp().getRequest<Request>().header('x-api-key') ?? '';
    if (!timingSafeEqual(resumen(recibida), resumen(esperada))) {
      throw new UnauthorizedException({ statusCode: 401, code: 'API_KEY_INVALIDA', message: 'API key inválida' });
    }
    return true;
  }
}
