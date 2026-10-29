import type { Request, Response } from 'express';
import type { SesionWebResponse } from '../../application/services/emisor-sesion.service';

/**
 * Panel web: el refresh token viaja en una cookie httpOnly, que JavaScript no puede leer (un XSS no se lo lleva).
 * La web lo pide con el header `X-Sesion-Web: cookie`; sin él, el token va en el cuerpo como siempre (app móvil).
 * Leer la cookie solo con ese header también evita el CSRF: un header propio obliga al navegador a preguntar antes
 * por CORS, y CORS solo deja enviar credenciales a los orígenes de WEB_ORIGENES (ver shared/infrastructure/config/cors.ts)
 */
export const HEADER_SESION_WEB = 'x-sesion-web';
const COOKIE = 'cmp_sesion_web';

// Solo viaja a /auth (refresh y logout), no en cada petición a la API. Strict: nunca desde otro sitio.
// secure según el protocolo: en Azure siempre es https (trust proxy lo lee del ingress); en local, http://localhost
const opciones = (req: Request) => ({ httpOnly: true, secure: req.secure, sameSite: 'strict' as const, path: '/auth' });

export const usaCookie = (req: Request) => req.headers[HEADER_SESION_WEB] === 'cookie';

// El token es base64url: no necesita decodificarse
export function leerCookieSesion(req: Request): string | undefined {
  for (const par of req.headers.cookie?.split(';') ?? []) {
    const [nombre, ...valor] = par.trim().split('=');
    if (nombre === COOKIE) return valor.join('=') || undefined;
  }
  return undefined;
}

// Con la cookie, el refresh token no vuelve en el cuerpo: así JavaScript nunca lo ve
export function responderSesionWeb<T extends SesionWebResponse>(req: Request, res: Response, sesion: T) {
  if (!usaCookie(req)) return sesion;
  const { refreshToken, ...resto } = sesion;
  res.cookie(COOKIE, refreshToken, { ...opciones(req), expires: new Date(sesion.refreshTokenExpiraEn) });
  return resto;
}

export const borrarCookieSesion = (req: Request, res: Response) => res.clearCookie(COOKIE, opciones(req));
