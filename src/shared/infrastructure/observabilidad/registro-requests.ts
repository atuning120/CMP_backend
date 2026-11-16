import { Logger, type LoggerService } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/*
 * Una línea por request para Log Analytics (en producción es JSON, ver main.ts): qué ruta, con qué resultado, cuánto
 * tardó y quién la pidió. Sirve para responder en el piloto "¿qué le pasó al teléfono del operador 1 a las 10:15?"
 * filtrando por idUsuario, o ver qué rutas fallan o se ponen lentas.
 *
 * Nunca registra query string, body, headers, IP ni nombres: solo el id de usuario y su rol (del JWT ya validado).
 * La ruta va como patrón (/maquinas/:id) para poder agrupar; si no calzó con ninguna (404), va la ruta pedida.
 */

export type RegistroHttp = Pick<LoggerService, 'log' | 'warn' | 'error'>;

export interface LineaRequest {
  evento: 'request';
  metodo: string;
  ruta: string;
  status: number;
  ms: number;
  idUsuario: number | null;
  rol: string | null;
  // El cliente cortó antes de recibir la respuesta (p. ej. el timeout del teléfono con mala señal)
  abortada?: true;
}

// El probe de Azure consulta /health cada pocos segundos: registrarlo solo agrega ruido y costo
const OMITIDAS = new Set(['/health']);
const LARGO_MAXIMO_RUTA = 200;

interface UsuarioJwt {
  idUsuario?: number;
  rol?: string;
}

const rutaDe = (req: Request): string => {
  const patron = (req.route as { path?: unknown } | undefined)?.path;
  const ruta = typeof patron === 'string' ? `${req.baseUrl}${patron}` : req.path;
  return ruta.slice(0, LARGO_MAXIMO_RUTA);
};

export function registrarRequests(registro: RegistroHttp = new Logger('Http')): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Los preflight CORS los responde el middleware de CORS y no dicen nada útil
    if (req.method === 'OPTIONS' || OMITIDAS.has(req.path)) return next();

    const inicio = process.hrtime.bigint();
    // 'close' llega siempre (también si el cliente cortó); 'finish' solo cuando la respuesta se envió completa
    res.once('close', () => {
      const usuario = (req as Request & { user?: UsuarioJwt }).user;
      const linea: LineaRequest = {
        evento: 'request',
        metodo: req.method,
        ruta: rutaDe(req),
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - inicio) / 1e5) / 10,
        idUsuario: usuario?.idUsuario ?? null,
        rol: usuario?.rol ?? null,
        ...(res.writableFinished ? {} : { abortada: true as const }),
      };
      if (linea.status >= 500) registro.error(linea);
      else if (linea.status >= 400 || linea.abortada) registro.warn(linea);
      else registro.log(linea);
    });
    next();
  };
}
