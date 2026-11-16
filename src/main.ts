// Primero: OpenTelemetry (Application Insights) solo instrumenta los módulos que se cargan después de iniciarse
import './instrument';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarHttp } from './shared/infrastructure/config/http';
import { RegistroConTelemetria } from './shared/infrastructure/observabilidad/registro-con-telemetria';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // En producción, una línea JSON por log (level, context, message, stack): Log Analytics la consulta por campo,
    // p. ej. las requests de un usuario. En local, el formato legible de siempre. En ambos, los error van además a
    // Application Insights como excepciones
    logger: new RegistroConTelemetria(process.env.NODE_ENV === 'production' ? { json: true, colors: false } : {}),
  });
  configurarHttp(app, process.env.WEB_ORIGENES);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
