import { Injectable } from '@nestjs/common';
import { EmisorSesionService, SesionMovilResponse } from '../services/emisor-sesion.service';
import { RotacionRefreshTokenService } from '../services/rotacion-refresh-token.service';

export { GRACIA_ROTACION_MS } from '../services/rotacion-refresh-token.service';

// Renueva la sesión de la app móvil: solo operadores (con su ficha de operador) y jefes de turno
@Injectable()
export class RefrescarSesionUseCase {
  constructor(
    private readonly rotacion: RotacionRefreshTokenService,
    private readonly emisorSesion: EmisorSesionService,
  ) {}

  async execute(refreshToken: string | undefined, ahora: Date = new Date()): Promise<SesionMovilResponse> {
    const usuario = await this.rotacion.consumir(refreshToken, ahora, (u) =>
      u.rol === 'OPERADOR' && u.idOperador ? 'OPERADOR' : u.rol === 'JEFE_TURNO' ? 'JEFE_TURNO' : null,
    );
    return this.emisorSesion.emitir({ idUsuario: usuario.idUsuario, rol: usuario.rol, idOperador: usuario.idOperador }, ahora);
  }
}
