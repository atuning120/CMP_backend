import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { opcionesCors } from './cors';

/**
 * Middleware HTTP de la aplicación. Vive aquí (y no en main.ts) para que los tests levanten exactamente lo mismo.
 * Nada de esto pasa por Socket.IO, que atiende /socket.io antes que Express.
 */
export function configurarHttp(app: NestExpressApplication, origenesWeb: string | undefined): void {
  // Detrás del ingress de Azure: req.ip toma la IP del cliente desde X-Forwarded-For (un solo proxy de confianza,
  // así un X-Forwarded-For inventado por el cliente no cambia la IP). La usa el límite de intentos de login
  app.set('trust proxy', 1);
  // Headers de seguridad. La API solo responde JSON y archivos, nunca HTML: la CSP no permite cargar ni ejecutar
  // nada y nadie puede embeberla en un iframe. Quita además X-Powered-By (no anuncia que es Express). El panel
  // pide todo con fetch en modo CORS, así que Cross-Origin-Resource-Policy (same-origin) no le afecta
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    }),
  );
  // gzip de las respuestas (Nest no comprime por defecto): los polígonos de /geocercas/mapa pesan bastante
  app.use(compression());
  // El panel web (WEB_ORIGENES) puede enviar la cookie de sesión; el resto de los orígenes, solo el JWT
  app.enableCors(opcionesCors(origenesWeb));
}
