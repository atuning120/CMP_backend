import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import type { IdentidadMicrosoft, VerificadorEntraIdPort } from '../../application/ports/verificador-entra-id.port';

// Claves públicas de Microsoft para cualquier organización (la app es multi-tenant)
const JWKS_COMUN = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Discovery pública de Entra ID: para un dominio verificado, el issuer trae el id de su tenant
const DISCOVERY = (dominio: string) => `https://login.microsoftonline.com/${encodeURIComponent(dominio)}/v2.0/.well-known/openid-configuration`;
const ISSUER_TENANT = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i;
// El dueño de un dominio casi nunca cambia; un dominio sin tenant se vuelve a consultar antes
const CACHE_TENANT_MS = 24 * 60 * 60 * 1000;
const CACHE_SIN_TENANT_MS = 60 * 60 * 1000;
const TIMEOUT_DISCOVERY_MS = 5000;

/**
 * Verifica ID tokens de Microsoft Entra ID (v2.0). Como la app acepta cuentas de cualquier
 * organización, el emisor esperado se arma con el tenant del propio token y se exige que coincida.
 * Config: AZURE_AD_CLIENT_ID (obligatoria) y AZURE_AD_JWKS_URI (opcional).
 */
@Injectable()
export class VerificadorEntraIdAdapter implements VerificadorEntraIdPort {
  private readonly clientId: string;
  private readonly jwksUri: string;
  private readonly jwks: jwksClient.JwksClient;
  private readonly tenantsPorDominio = new Map<string, { tenant: string | null; expira: number }>();

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('AZURE_AD_CLIENT_ID', '').trim();
    this.jwksUri = config.get<string>('AZURE_AD_JWKS_URI', '').trim() || JWKS_COMUN;
    this.jwks = jwksClient({
      jwksUri: this.jwksUri,
      cache: true,
      rateLimit: true,
    });
  }

  // Solo se llama con dominios de la lista permitida, así que la URL consultada no la elige el cliente
  async tenantDelDominio(dominio: string): Promise<string | null> {
    const ahora = Date.now();
    const enCache = this.tenantsPorDominio.get(dominio);
    if (enCache && enCache.expira > ahora) return enCache.tenant;

    const respuesta = await fetch(DISCOVERY(dominio), { signal: AbortSignal.timeout(TIMEOUT_DISCOVERY_MS) });
    let tenant: string | null = null;
    if (respuesta.ok) {
      const { issuer } = (await respuesta.json()) as { issuer?: unknown };
      tenant = typeof issuer === 'string' ? (ISSUER_TENANT.exec(issuer)?.[1]?.toLowerCase() ?? null) : null;
    } else if (respuesta.status !== 400) {
      // 400 = dominio sin tenant en Entra ID; cualquier otro error es de Microsoft y no se guarda
      throw new Error(`discovery de ${dominio} respondió ${respuesta.status}`);
    }
    this.tenantsPorDominio.set(dominio, { tenant, expira: ahora + (tenant ? CACHE_TENANT_MS : CACHE_SIN_TENANT_MS) });
    return tenant;
  }

  async verificar(idToken: string): Promise<IdentidadMicrosoft | null> {
    if (!this.clientId) return null;

    const decodificado = jwt.decode(idToken, { complete: true });
    const tid = (decodificado?.payload as jwt.JwtPayload | undefined)?.tid;
    if (!decodificado?.header.kid || typeof tid !== 'string' || !GUID.test(tid)) {
      throw new Error('Token sin kid o tenant');
    }

    let clave: jwksClient.SigningKey;
    try {
      clave = await this.jwks.getSigningKey(decodificado.header.kid);
    } catch (error) {
      // Suele ser una AZURE_AD_JWKS_URI mal configurada: se indica cuál para diagnosticarlo rápido
      throw new Error(`No se pudo obtener la clave de firma desde ${this.jwksUri}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
