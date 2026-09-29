import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { USUARIO_REPOSITORY } from '../../domain/repositories/usuario.repository.port';
import type { UsuarioRepositoryPort } from '../../domain/repositories/usuario.repository.port';
import { LoginWebRequestDto } from '../../interface/http/dtos/login-web.request.dto';

@Injectable()
export class LoginWebUseCase {
  private jwksClient: jwksClient.JwksClient;

  constructor(
    @Inject(USUARIO_REPOSITORY)
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwksClient = jwksClient({
      jwksUri: this.configService.get<string>('AZURE_AD_JWKS_URI', ''),
      cache: true,
      rateLimit: true,
    });
  }

  async execute(dto: LoginWebRequestDto): Promise<{ accessToken: string }> {
    try {
      // 1. Decodificar el token sin verificar la firma para obtener el key id (kid)
      const decoded = jwt.decode(dto.entraIdToken, { complete: true });
      if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new UnauthorizedException('Token Entra ID inválido');
      }

      // 2. Obtener la llave pública desde JWKS de Microsoft
      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      // 3. Verificar el token usando la llave pública, issuer y audience
      const payload = jwt.verify(dto.entraIdToken, publicKey, {
        audience: this.configService.get<string>('AZURE_AD_CLIENT_ID'),
        issuer: this.configService.get<string>('AZURE_AD_ISSUER'),
      }) as jwt.JwtPayload;

      // 4. Buscar el usuario en nuestra DB usando el email
      // En Entra ID el email suele venir en 'preferred_username' o 'email'
      const email = payload.preferred_username || payload.email;
      if (!email) {
        throw new UnauthorizedException('El token no contiene un email válido');
      }

      const usuario = await this.usuarioRepo.findByEmail(email);
      if (!usuario) {
        throw new UnauthorizedException('Usuario no registrado o inactivo en el sistema');
      }

      // 5. Generar nuestro propio JWT interno
      const internalPayload = { sub: usuario.idUsuario, rol: usuario.rol };
      const accessToken = this.jwtService.sign(internalPayload);

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Fallo la autenticación con Entra ID');
    }
  }
}
