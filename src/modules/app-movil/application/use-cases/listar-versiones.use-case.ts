import { Inject, Injectable } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionApp, VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { exigirAdmin } from '../limites-apk';

// Lo que ve cualquiera en la página pública: sin el nombre del blob ni quién la subió
export type VersionPublica = Pick<VersionApp, 'idVersion' | 'version' | 'notas' | 'tamanoBytes' | 'subidaEn'>;

/**
 * Historial de versiones de la app, de la más alta a la más baja. Público: solo las publicadas. Administrador: todas,
 * también las retiradas.
 */
@Injectable()
export class ListarVersionesUseCase {
  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
  ) {}

  async publicas(): Promise<VersionPublica[]> {
    return (await this.versiones.listar(true)).map(({ idVersion, version, notas, tamanoBytes, subidaEn }) => ({
      idVersion,
      version,
      notas,
      tamanoBytes,
      subidaEn,
    }));
  }

  async todas(rol: string | undefined): Promise<VersionApp[]> {
    exigirAdmin(rol);
    return this.versiones.listar(false);
  }
}
