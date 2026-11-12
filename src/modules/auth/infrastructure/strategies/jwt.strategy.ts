import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { leerJwtSecret } from '../../../../shared/infrastructure/config/secretos';
import { VerificadorSesionService } from '../../application/services/verificador-sesion.service';
import { sesionInvalida } from '../../application/services/rotacion-refresh-token.service';

export interface JwtPayload {
  sub: number;
  rol: string;
  idOperador?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly verificadorSesion: VerificadorSesionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: leerJwtSecret(configService.get<string>('JWT_SECRET')),
    });
  }

  // Firma y vencimiento ya los revisó passport-jwt. Además el usuario debe seguir activo y con el mismo rol: si no,
  // 401 SESION_INVALIDA, el cliente renueva la sesión y el refresh decide (rol nuevo o sesión cerrada)
  async validate(payload: JwtPayload) {
    if (!(await this.verificadorSesion.vigente(payload))) throw sesionInvalida();
    return { idUsuario: payload.sub, rol: payload.rol, idOperador: payload.idOperador };
  }
}
