import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detrás del ingress de Azure: req.ip toma la IP del cliente desde X-Forwarded-For (un solo proxy de confianza,
  // así un X-Forwarded-For inventado por el cliente no cambia la IP). La usa el límite de intentos de login
  app.set('trust proxy', 1);
  // gzip de las respuestas (Nest no comprime por defecto): los polígonos de /geocercas/mapa pesan bastante.
  // No afecta a Socket.IO (no pasa por el middleware de Express)
  app.use(compression());
  // Allow connections from frontend. Content-Disposition: el panel web lee el nombre de los archivos que descarga (Excel)
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
