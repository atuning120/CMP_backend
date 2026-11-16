import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarHttp } from './shared/infrastructure/config/http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // En producción, una línea JSON por log (level, context, message, stack): Log Analytics la consulta por campo,
    // p. ej. las requests de un usuario. En local, el formato legible de siempre
    logger: process.env.NODE_ENV === 'production' ? new ConsoleLogger({ json: true, colors: false }) : undefined,
  });
  configurarHttp(app, process.env.WEB_ORIGENES);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
