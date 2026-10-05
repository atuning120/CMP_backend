import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/repositories/refresh-token.repository.port';
import { USUARIO_REPOSITORY } from '../../../usuarios/domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../../usuarios/domain/repositories/usuario.repository.port';
import { EmisorSesionService, hashRefreshToken, SesionMovilResponse } from '../services/emisor-sesion.service';

// Un token recién rotado sigue aceptándose unos segundos: en terreno la respuesta del refresh
// puede perderse por mala señal y la app reintentaría con el token anterior.
export const GRACIA_ROTACION_MS = 60 * 1000;

const sesionInvalida = () =>
  new UnauthorizedException({ statusCode: 401, code: 'SESION_INVALIDA', message: 'La sesión no es válida. Inicia sesión nuevamente.' });

@Injectable()
export class RefrescarSesionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly emisorSesion: EmisorSesionService,
  ) {}

  async execute(refreshToken: string | undefined, ahora: Date = new Date()): Promise<SesionMovilResponse> {
    if (!refreshToken) throw sesionInvalida();

    const registro = await this.refreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (!registro || registro.expiraEn <= ahora) throw sesionInvalida();

    if (registro.revocadoEn && ahora.getTime() - registro.revocadoEn.getTime() > GRACIA_ROTACION_MS) {
      // Reutilización de un token ya rotado: posible robo. Se cierran todas las sesiones del usuario.
      await this.refreshTokenRepo.revocarTodosDelUsuario(registro.idUsuario, ahora);
      throw sesionInvalida();
    }

    // El usuario pudo ser desactivado o cambiar de rol desde que inició sesión
    const usuario = await this.usuarioRepo.findById(registro.idUsuario);
    const rolMovil = usuario?.rol === 'OPERADOR' && usuario.idOperador ? 'OPERADOR' : usuario?.rol === 'JEFE_TURNO' ? 'JEFE_TURNO' : null;
    if (!usuario || !rolMovil) {
      await this.refreshTokenRepo.revocarTodosDelUsuario(registro.idUsuario, ahora);
      throw sesionInvalida();
    }

    await this.refreshTokenRepo.revocar(registro.idRefreshToken, ahora);
    return this.emisorSesion.emitir({ idUsuario: usuario.idUsuario, rol: rolMovil, idOperador: usuario.idOperador }, ahora);
  }
}
