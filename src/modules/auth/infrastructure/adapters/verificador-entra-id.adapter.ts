import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import type { IdentidadMicrosoft, VerificadorEntraIdPort } from '../../application/ports/verificador-entra-id.port';

// Claves públicas de Microsoft para cualquier organización (la app es multi-tenant)
const JWKS_COMUN = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica ID tokens de Microsoft Entra ID (v2.0). Como la app acepta cuentas de cualquier
 * organización, el emisor esperado se arma con el tenant del propio token y se exige que coincida.
 * Config: AZURE_AD_CLIENT_ID (obligatoria) y AZURE_AD_JWKS_URI (opcional).
 */
@Injectable()
export class VerificadorEntraIdAdapter implements VerificadorEntraIdPort {
  private readonly clientId: string;
  private readonly jwks: jwksClient.JwksClient;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('AZURE_AD_CLIENT_ID', '').trim();
    this.jwks = jwksClient({
      jwksUri: config.get<string>('AZURE_AD_JWKS_URI', '').trim() || JWKS_COMUN,
      cache: true,
      rateLimit: true,
    });
  }

  async verificar(idToken: string): Promise<IdentidadMicrosoft | null> {
    if (!this.clientId) return null;

    const decodificado = jwt.decode(idToken, { complete: true });
    const tid = (decodificado?.payload as jwt.JwtPayload | undefined)?.tid;
    if (!decodificado?.header.kid || typeof tid !== 'string' || !GUID.test(tid)) {
      throw new Error('Token sin kid o tenant');
    }

    const clave = await this.jwks.getSigningKey(decodificado.header.kid);
    const payload = jwt.verify(idToken, clave.getPublicKey(), {
      algorithms: ['RS256'],
      audience: this.clientId,
      issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
    }) as jwt.JwtPayload;

    const email = [payload.email, payload.preferred_username].find((v) => typeof v === 'string' && v.includes('@'));
    return {
      oid: String(payload.oid ?? ''),
      tid,
      email: email ? String(email).trim().toLowerCase() : null,
      nombre: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null,
    };
  }
}
