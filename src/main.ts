import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarHttp } from './shared/infrastructure/config/http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarHttp(app, process.env.WEB_ORIGENES);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
