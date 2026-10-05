import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/repositories/refresh-token.repository.port';

export type SesionMovilResponse =
  | { accessToken: string; refreshToken: string; refreshTokenExpiraEn: string; rol: 'OPERADOR'; idOperador: number }
  | { accessToken: string; refreshToken: string; refreshTokenExpiraEn: string; rol: 'JEFE_TURNO' };

export interface UsuarioSesion {
  idUsuario: number;
  rol: 'OPERADOR' | 'JEFE_TURNO';
  idOperador: number | null;
}

export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Emite el par access token (JWT de corta duración) + refresh token (opaco, larga duración)
 * de la app móvil. El refresh token permite renovar la sesión sin volver a pedir la contraseña.
 */
@Injectable()
export class EmisorSesionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
  ) {}

  async emitir(usuario: UsuarioSesion, ahora: Date = new Date()): Promise<SesionMovilResponse> {
    const refreshToken = randomBytes(48).toString('base64url');
    const dias = Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'));
    const expiraEn = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.create({ idUsuario: usuario.idUsuario, tokenHash: hashRefreshToken(refreshToken), expiraEn });

    const base = { refreshToken, refreshTokenExpiraEn: expiraEn.toISOString() };
    if (usuario.rol === 'OPERADOR' && usuario.idOperador) {
      const payload = { sub: usuario.idUsuario, rol: usuario.rol, idOperador: usuario.idOperador };
      return { ...base, accessToken: this.jwtService.sign(payload), rol: 'OPERADOR', idOperador: usuario.idOperador };
    }
    const payload = { sub: usuario.idUsuario, rol: usuario.rol };
    return { ...base, accessToken: this.jwtService.sign(payload), rol: 'JEFE_TURNO' };
  }
}
