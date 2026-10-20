import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/repositories/refresh-token.repository.port';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { hashRefreshToken } from './emisor-sesion.service';

// Un token recién rotado sigue aceptándose unos segundos: en terreno la respuesta del refresh
// puede perderse por mala señal y la app reintentaría con el token anterior. En la web cubre
// también dos pestañas que renuevan a la vez.
export const GRACIA_ROTACION_MS = 60 * 1000;

export const sesionInvalida = () =>
  new UnauthorizedException({ statusCode: 401, code: 'SESION_INVALIDA', message: 'La sesión no es válida. Inicia sesión nuevamente.' });

export interface UsuarioRefresco {
  idUsuario: number;
  rol: string;
  idOperador: number | null;
}

/**
 * Valida y consume un refresh token (rotación), común a la app móvil y al panel web. Cada canal decide
 * con rolDeSesion con qué rol sigue la sesión, o null si el usuario ya no tiene acceso a ese canal.
 */
@Injectable()
export class RotacionRefreshTokenService {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  async consumir<R extends string>(
    refreshToken: string | undefined,
    ahora: Date,
    rolDeSesion: (usuario: UsuarioRefresco) => R | null,
  ): Promise<UsuarioRefresco & { rol: R }> {
    if (!refreshToken) throw sesionInvalida();

    const registro = await this.refreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (!registro || registro.expiraEn <= ahora) throw sesionInvalida();

    if (registro.revocadoEn && ahora.getTime() - registro.revocadoEn.getTime() > GRACIA_ROTACION_MS) {
      // Reutilización de un token ya rotado: posible robo. Se cierran todas las sesiones del usuario.
      await this.refreshTokenRepo.revocarTodosDelUsuario(registro.idUsuario, ahora);
      throw sesionInvalida();
    }

    // El usuario pudo ser desactivado o cambiar de rol desde que inició sesión (findById solo devuelve activos)
    const usuario = await this.usuarioRepo.findById(registro.idUsuario);
    const rol = usuario ? rolDeSesion(usuario) : null;
    if (!usuario || !rol) {
      await this.refreshTokenRepo.revocarTodosDelUsuario(registro.idUsuario, ahora);
      throw sesionInvalida();
    }

    await this.refreshTokenRepo.revocar(registro.idRefreshToken, ahora);
    return { ...usuario, rol };
  }
}
