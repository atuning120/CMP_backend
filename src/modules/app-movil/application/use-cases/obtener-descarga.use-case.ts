import { Inject, Injectable } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { ALMACENAMIENTO_APK } from '../../domain/ports/almacenamiento-apk.port';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';
import { nombreDescarga } from '../../domain/numero-version';
import { appMovilError } from '../app-movil.errors';
import { VIGENCIA_DESCARGA_MS } from '../limites-apk';

/**
 * Enlace firmado para descargar una versión publicada ('ultima': la más alta). Público: el controller redirige a él, así
 * los enlaces de la página y el QR no vencen aunque el archivo siga en un contenedor privado.
 */
@Injectable()
export class ObtenerDescargaUseCase {
  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
    // null sin almacenamiento configurado (desarrollo local sin Azure)
    @Inject(ALMACENAMIENTO_APK)
    private readonly almacenamiento: AlmacenamientoApkPort | null,
  ) {}

  async execute(idVersion: number | 'ultima', ahora: Date = new Date()): Promise<string> {
    if (!this.almacenamiento) throw appMovilError('DESCARGA_NO_CONFIGURADA');

    const version = idVersion === 'ultima' ? ((await this.versiones.listar(true))[0] ?? null) : await this.versiones.buscar(idVersion);
    if (!version) throw appMovilError(idVersion === 'ultima' ? 'APK_NO_PUBLICADA' : 'VERSION_NO_ENCONTRADA');
    // Una versión retirada no se descarga ni conociendo su número
    if (!version.publicada) throw appMovilError('VERSION_NO_ENCONTRADA');

    return this.almacenamiento.urlDescarga(version.archivo, nombreDescarga(version.version), new Date(ahora.getTime() + VIGENCIA_DESCARGA_MS));
  }
}
