import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { leerSslDb } from '../../../../shared/infrastructure/config/ssl-db';

// Pocas conexiones: solo la usan la carga del Excel y la lista de cargas
const MAXIMO_CONEXIONES = 3;

/**
 * Base de datos del schema `reportes` (cargas del Excel del EP). TEMPORAL: mientras Metabase lee la base de desarrollo
 * (Aiven), producción guarda ahí las cargas con REPORTES_DB_HOST, REPORTES_DB_PORT, REPORTES_DB_USER,
 * REPORTES_DB_PASSWORD, REPORTES_DB_NAME, REPORTES_DB_SSL y REPORTES_DB_SSL_CA (mismo formato que las DB_*).
 * Sin REPORTES_DB_HOST se usa la base principal, como el resto del Backend.
 * null si no hay base separada. Lanza un error si está a medio configurar: escribir en la principal sin avisar sería peor.
 */
export const opcionesBaseReportes = (leer: (clave: string) => string | undefined): DataSourceOptions | null => {
  const valor = (clave: string) => leer(clave)?.trim() || undefined;
  const host = valor('REPORTES_DB_HOST');
  if (!host) return null;
  const faltantes = ['REPORTES_DB_USER', 'REPORTES_DB_PASSWORD', 'REPORTES_DB_NAME'].filter((clave) => !valor(clave));
  if (faltantes.length) throw new Error(`REPORTES_DB_HOST está configurada pero faltan ${faltantes.join(', ')}`);
  const puerto = Number(valor('REPORTES_DB_PORT') ?? '5432');
  if (!Number.isInteger(puerto) || puerto <= 0) throw new Error('REPORTES_DB_PORT debe ser un número de puerto');
  return {
    type: 'postgres',
    host,
    port: puerto,
    username: valor('REPORTES_DB_USER'),
    password: valor('REPORTES_DB_PASSWORD'),
    database: valor('REPORTES_DB_NAME'),
    ssl: leerSslDb(valor('REPORTES_DB_SSL'), valor('REPORTES_DB_SSL_CA')),
    synchronize: false,
    extra: { max: MAXIMO_CONEXIONES },
  };
};

@Injectable()
export class ConexionReportes implements OnModuleDestroy {
  private readonly logger = new Logger('ConexionReportes');
  private readonly opciones: DataSourceOptions | null;
  private propia: Promise<DataSource> | null = null;

  constructor(
    readonly principal: DataSource,
    config: ConfigService,
  ) {
    this.opciones = opcionesBaseReportes((clave) => config.get<string>(clave));
    if (this.opciones) this.logger.warn('Las cargas del estado de pago se guardan en una base separada (REPORTES_DB_*), no en la principal');
  }

  get separada(): boolean {
    return this.opciones !== null;
  }

  // Se conecta en el primer uso: si la base de reportes no responde, solo fallan los dashboards, no el arranque. Un
  // error no queda guardado: la próxima petición vuelve a intentar
  dataSource(): Promise<DataSource> {
    if (!this.opciones) return Promise.resolve(this.principal);
    this.propia ??= new DataSource(this.opciones).initialize().catch((error: unknown) => {
      this.propia = null;
      throw error;
    });
    return this.propia;
  }

  async onModuleDestroy(): Promise<void> {
    const propia = await this.propia?.catch(() => null);
    if (propia?.isInitialized) await propia.destroy();
  }
}
