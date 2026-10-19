import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detrás del ingress de Azure: req.ip toma la IP del cliente desde X-Forwarded-For (un solo proxy de confianza,
  // así un X-Forwarded-For inventado por el cliente no cambia la IP). La usa el límite de intentos de login
  app.set('trust proxy', 1);
  app.enableCors(); // Allow connections from frontend
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
