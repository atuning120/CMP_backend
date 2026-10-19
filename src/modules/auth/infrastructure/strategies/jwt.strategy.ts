import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { leerJwtSecret } from '../../../../shared/infrastructure/config/secretos';

export interface JwtPayload {
  sub: number;
  rol: string;
  idOperador?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: leerJwtSecret(configService.get<string>('JWT_SECRET')),
    });
  }

  async validate(payload: JwtPayload) {
    return { idUsuario: payload.sub, rol: payload.rol, idOperador: payload.idOperador };
  }
}
