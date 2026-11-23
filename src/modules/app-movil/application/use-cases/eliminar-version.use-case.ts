import { Inject, Injectable, Logger } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { ALMACENAMIENTO_APK } from '../../domain/ports/almacenamiento-apk.port';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';
import { appMovilError } from '../app-movil.errors';
import { exigirAdmin } from '../limites-apk';

// Borra una versión del historial y su archivo (solo ADMIN). No se puede deshacer
@Injectable()
export class EliminarVersionUseCase {
  private readonly logger = new Logger(EliminarVersionUseCase.name);

  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
    @Inject(ALMACENAMIENTO_APK)
    private readonly almacenamiento: AlmacenamientoApkPort | null,
  ) {}

  async execute(datos: { rol: string | undefined; idVersion: number }): Promise<void> {
    exigirAdmin(datos.rol);
    const borrada = await this.versiones.eliminar(datos.idVersion);
    if (!borrada) throw appMovilError('VERSION_NO_ENCONTRADA');
    // La fila ya no está: si falla borrar el archivo, solo queda ocupando espacio en el contenedor
    await this.almacenamiento?.eliminar(borrada.archivo).catch((error: unknown) => {
      this.logger.error(`No se pudo borrar el archivo ${borrada.archivo}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}
