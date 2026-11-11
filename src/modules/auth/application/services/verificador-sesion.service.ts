import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { rolEnPanelWeb } from '../use-cases/login-web-credenciales.use-case';

// Cuánto tarda, como máximo, en notarse que un usuario fue desactivado o cambió de rol (antes: lo que le quedaba
// al access token, hasta 1 h). La caché es por réplica: con varias, cada una lo nota en este plazo
export const TTL_CACHE_SESION_MS = 30 * 1000;

export interface PayloadSesion {
  sub: number;
  rol?: string;
  idOperador?: number | null;
}

type UsuarioVigente = { rol: string; idOperador: number | null } | null;

/**
 * Revisa que el usuario de un access token siga activo y con el rol con que se emitió el token: el JWT dura hasta
 * 1 h y el rol va dentro, así que sin esto un usuario desactivado o con menos permisos seguiría entrando hasta que
 * venciera. Lo usan JwtStrategy (cada petición HTTP) y los sockets (al conectar y periódicamente).
 *
 * Un token deja de valer si su rol ya no corresponde al del usuario. Vale el rol de la app (el mismo) o el del panel
 * web (rolEnPanelWeb: un OPERADOR entra a la web como VISOR). Si el rol cambió, el cliente recibe 401, renueva la
 * sesión y el refresh emite un token con el rol nuevo (o la cierra, si ya no tiene acceso a ese canal).
 *
 * Caché corta por usuario para no consultar la base en cada petición: la app sincroniza muchas seguidas.
 */
@Injectable()
export class VerificadorSesionService {
  private readonly cache = new Map<number, { usuario: Promise<UsuarioVigente>; vence: number }>();

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  async vigente(payload: PayloadSesion, ahora: number = Date.now()): Promise<boolean> {
    if (!Number.isInteger(payload?.sub) || typeof payload.rol !== 'string') return false;
    const usuario = await this.usuarioActual(payload.sub, ahora);
    if (!usuario) return false;
    if (payload.rol !== usuario.rol && payload.rol !== rolEnPanelWeb(usuario.rol)) return false;
    // El token del operador lleva su ficha: si la cuenta quedó asociada a otra, el token ya no corresponde
    if (payload.idOperador != null && payload.idOperador !== usuario.idOperador) return false;
    return true;
  }

  // Las peticiones que llegan juntas comparten la misma consulta (se guarda la promesa, no el resultado)
  private usuarioActual(idUsuario: number, ahora: number): Promise<UsuarioVigente> {
    const guardado = this.cache.get(idUsuario);
    if (guardado && guardado.vence > ahora) return guardado.usuario;

    // findById solo devuelve usuarios activos
    const usuario = this.usuarioRepo
      .findById(idUsuario)
      .then((u) => (u ? { rol: u.rol, idOperador: u.idOperador } : null));
    this.cache.set(idUsuario, { usuario, vence: ahora + TTL_CACHE_SESION_MS });
    // Un error de la base no se guarda: la siguiente petición vuelve a consultar
    usuario.catch(() => {
      if (this.cache.get(idUsuario)?.usuario === usuario) this.cache.delete(idUsuario);
    });
    return usuario;
  }
}
