import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { ALMACENAMIENTO_APK } from '../../domain/ports/almacenamiento-apk.port';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';
import { esVersionValida } from '../../domain/numero-version';
import { appMovilError } from '../app-movil.errors';
import { archivoDeSubida, exigirAdmin, TAMANO_MAXIMO_APK, VIGENCIA_SUBIDA_MS } from '../limites-apk';

export interface SubidaPreparada {
  archivo: string;
  urlSubida: string;
  expiraEn: Date;
}

/**
 * Paso 1 de publicar una versión (solo ADMIN): revisa el número de versión y el tamaño, y entrega un enlace para que el
 * navegador suba la APK directo al almacenamiento (~80 MB no pasan por el Backend). El paso 2 es RegistrarVersion.
 */
@Injectable()
export class PrepararSubidaUseCase {
  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
    @Inject(ALMACENAMIENTO_APK)
    private readonly almacenamiento: AlmacenamientoApkPort | null,
  ) {}

  async execute(datos: { rol: string | undefined; version: unknown; tamanoBytes: unknown }, ahora: Date = new Date()): Promise<SubidaPreparada> {
    exigirAdmin(datos.rol);
    if (!esVersionValida(datos.version)) throw appMovilError('VERSION_INVALIDA');
    const tamano = Number(datos.tamanoBytes);
    if (!Number.isInteger(tamano) || tamano <= 0 || tamano > TAMANO_MAXIMO_APK) throw appMovilError('ARCHIVO_INVALIDO');
    if (!this.almacenamiento) throw appMovilError('DESCARGA_NO_CONFIGURADA');
    if (await this.versiones.existeVersion(datos.version)) throw appMovilError('VERSION_EXISTENTE');

    const archivo = archivoDeSubida(datos.version, randomBytes(4).toString('hex'));
    const expiraEn = new Date(ahora.getTime() + VIGENCIA_SUBIDA_MS);
    return { archivo, urlSubida: await this.almacenamiento.urlSubida(archivo, expiraEn), expiraEn };
  }
}
