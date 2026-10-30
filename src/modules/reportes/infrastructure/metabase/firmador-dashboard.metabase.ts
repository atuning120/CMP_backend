import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { DashboardEmbebido, FirmadorDashboardPort, TipoDashboard } from '../../domain/ports/firmador-dashboard.port';

// El iframe hace sus consultas con este token: al vencer, la web pide uno nuevo
export const DURACION_TOKEN_DASHBOARD_MS = 60 * 60 * 1000;

// La Container App escala a 0: mientras arranca, su proxy demora o responde un error en vez de Metabase
const TIMEOUT_SALUD_MS = 5000;

const VARIABLE_DASHBOARD: Record<TipoDashboard, string> = {
  OPERACION: 'METABASE_DASHBOARD_OPERACION',
  ESTADO_PAGO: 'METABASE_DASHBOARD_ESTADO_PAGO',
};

/**
 * Static embedding de Metabase ("incrustación para invitados"): JWT firmado con la clave de incrustación del
 * administrador de Metabase (METABASE_SECRET_KEY) que dice qué dashboard abrir y con qué filtros bloqueados.
 * La clave nunca sale del Backend; el id de cada dashboard es el número de su URL en Metabase.
 */
@Injectable()
export class FirmadorDashboardMetabase implements FirmadorDashboardPort {
  constructor(private readonly config: ConfigService) {}

  private sitio(): string {
    return this.config.get<string>('METABASE_SITE_URL', '').trim().replace(/\/+$/, '');
  }

  firmar(tipo: TipoDashboard, parametros: Record<string, string | number>, ahora: Date): DashboardEmbebido | null {
    const sitio = this.sitio();
    const secreto = this.config.get<string>('METABASE_SECRET_KEY', '').trim();
    const idDashboard = Number(this.config.get<string>(VARIABLE_DASHBOARD[tipo], ''));
    if (!sitio || !secreto || !Number.isInteger(idDashboard) || idDashboard <= 0) return null;

    const expiraEn = new Date(ahora.getTime() + DURACION_TOKEN_DASHBOARD_MS);
    const token = jwt.sign(
      {
        resource: { dashboard: idDashboard },
        params: parametros,
        iat: Math.floor(ahora.getTime() / 1000),
        exp: Math.floor(expiraEn.getTime() / 1000),
      },
      secreto,
      { algorithm: 'HS256' },
    );
    // Sin borde ni título: la página de la web ya muestra el suyo
    return { url: `${sitio}/embed/dashboard/${token}#bordered=false&titled=false`, expiraEn };
  }

  // GET /api/health responde {"status":"ok"} cuando Metabase terminó de arrancar. La consulta también lo despierta
  async disponible(): Promise<boolean> {
    try {
      const respuesta = await fetch(`${this.sitio()}/api/health`, { signal: AbortSignal.timeout(TIMEOUT_SALUD_MS) });
      if (!respuesta.ok) return false;
      const cuerpo = (await respuesta.json()) as { status?: string } | null;
      return cuerpo?.status === 'ok';
    } catch {
      return false;
    }
  }
}
