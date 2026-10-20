import { Injectable } from '@nestjs/common';
import { EmisorSesionService, SesionWebResponse } from '../services/emisor-sesion.service';
import { RotacionRefreshTokenService } from '../services/rotacion-refresh-token.service';
import { ROLES_WEB } from './login-web-credenciales.use-case';

// Renueva la sesión del panel web. El rol se vuelve a leer: si un administrador lo cambió, la sesión sigue con el nuevo
@Injectable()
export class RefrescarSesionWebUseCase {
  constructor(
    private readonly rotacion: RotacionRefreshTokenService,
    private readonly emisorSesion: EmisorSesionService,
  ) {}

  async execute(refreshToken: string | undefined, ahora: Date = new Date()): Promise<SesionWebResponse> {
    const usuario = await this.rotacion.consumir(refreshToken, ahora, (u) => (ROLES_WEB.includes(u.rol) ? u.rol : null));
    return this.emisorSesion.emitirWeb(usuario, ahora);
  }
}
