import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const MINUTO = 60 * 1000;

// Cuenta a la que apunta el intento: el mismo correo o RUT escrito de distintas formas suma al mismo contador
const cuentaDelIntento = (req: { body?: { email?: unknown; rut?: unknown }; ip?: string }): string => {
  const { email, rut } = req.body ?? {};
  if (typeof email === 'string' && email.trim()) return `email:${email.trim().toLowerCase()}`;
  if (typeof rut === 'string' && rut.trim()) return `rut:${rut.replace(/[.\s-]/g, '').toUpperCase()}`;
  // Sin identificador (p. ej. el login con Microsoft) el límite por cuenta cae en la IP
  return `ip:${req.ip ?? 'desconocida'}`;
};

/**
 * Límites de los endpoints de login y registro contra fuerza bruta. Solo se aplican donde se usa ThrottlerGuard
 * (AuthController), no al resto del API: la app móvil sincroniza muchas peticiones seguidas.
 * - cuenta: frena probar contraseñas contra una cuenta, aunque el atacante rote de IP.
 * - ip: holgado, porque en la mina muchos operadores pueden salir a internet por la misma IP (WiFi de la faena).
 * Los contadores viven en memoria de cada réplica; con varias réplicas el límite efectivo se multiplica.
 */
export const LIMITE_INTENTOS: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'cuenta', ttl: 15 * MINUTO, limit: 10, blockDuration: 15 * MINUTO, getTracker: (req) => cuentaDelIntento(req) },
    { name: 'ip', ttl: MINUTO, limit: 60 },
  ],
};

// Mismo formato que el resto de los errores del API (código estable + mensaje en español) para que los clientes lo traduzcan
@Injectable()
export class LimiteIntentosGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'DEMASIADOS_INTENTOS',
        message: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta nuevamente',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
