import { Inject, Injectable } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionApp, VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { appMovilError } from '../app-movil.errors';
import { exigirAdmin } from '../limites-apk';
import { notasValidas } from './registrar-version.use-case';

/**
 * Cambia las notas de una versión o la retira / vuelve a publicar (solo ADMIN). Retirar la saca de la página pública y
 * de la descarga sin borrar el archivo: sirve para una versión con un error que quizá se vuelva a ofrecer.
 */
@Injectable()
export class EditarVersionUseCase {
  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
  ) {}

  async execute(datos: { rol: string | undefined; idVersion: number; notas?: unknown; publicada?: unknown }): Promise<VersionApp> {
    exigirAdmin(datos.rol);
    if (!notasValidas(datos.notas)) throw appMovilError('NOTAS_INVALIDAS');
    const cambios: { notas?: string; publicada?: boolean } = {};
    if (datos.notas !== undefined) cambios.notas = datos.notas.trim();
    if (typeof datos.publicada === 'boolean') cambios.publicada = datos.publicada;

    const version = await this.versiones.actualizar(datos.idVersion, cambios);
    if (!version) throw appMovilError('VERSION_NO_ENCONTRADA');
    return version;
  }
}
