import { Injectable, Inject } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY } from '../../domain/repositories/refresh-token.repository.port';
import type { RefreshTokenRepositoryPort } from '../../domain/repositories/refresh-token.repository.port';
import { hashRefreshToken } from '../services/emisor-sesion.service';

// Revoca el refresh token del dispositivo. Es idempotente: un token desconocido no es un error.
@Injectable()
export class CerrarSesionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: RefreshTokenRepositoryPort,
  ) {}

  async execute(refreshToken: string | undefined, ahora: Date = new Date()): Promise<void> {
    if (!refreshToken) return;
    const registro = await this.refreshTokenRepo.findByHash(hashRefreshToken(refreshToken));
    if (registro) await this.refreshTokenRepo.revocar(registro.idRefreshToken, ahora);
  }
}
