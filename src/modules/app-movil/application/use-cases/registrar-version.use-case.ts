import { Inject, Injectable } from '@nestjs/common';
import { VERSION_APP_REPOSITORY } from '../../domain/repositories/version-app.repository.port';
import type { VersionApp, VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';
import { ALMACENAMIENTO_APK } from '../../domain/ports/almacenamiento-apk.port';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';
import { esVersionValida } from '../../domain/numero-version';
import { appMovilError } from '../app-movil.errors';
import { CABECERA_ZIP, esArchivoDeSubida, exigirAdmin, MAXIMO_NOTAS, TAMANO_MAXIMO_APK } from '../limites-apk';

export const notasValidas = (notas: unknown): notas is string | undefined =>
  notas === undefined || (typeof notas === 'string' && notas.length <= MAXIMO_NOTAS);

/**
 * Paso 2 de publicar una versión (solo ADMIN): con la APK ya subida, revisa que el archivo exista y sea un .apk de verdad
 * (un ZIP) y la registra en el historial, publicada. Si el archivo no sirve o el número de versión se ocupó entre medio,
 * lo borra para no dejar archivos huérfanos.
 */
@Injectable()
export class RegistrarVersionUseCase {
  constructor(
    @Inject(VERSION_APP_REPOSITORY)
    private readonly versiones: VersionAppRepositoryPort,
    @Inject(ALMACENAMIENTO_APK)
    private readonly almacenamiento: AlmacenamientoApkPort | null,
  ) {}

  async execute(datos: { rol: string | undefined; idUsuario: number; version: unknown; notas: unknown; archivo: unknown }): Promise<VersionApp> {
    exigirAdmin(datos.rol);
    if (!esVersionValida(datos.version)) throw appMovilError('VERSION_INVALIDA');
    if (!notasValidas(datos.notas)) throw appMovilError('NOTAS_INVALIDAS');
    // Solo un archivo entregado por PrepararSubida para esta misma versión
    if (!esArchivoDeSubida(datos.archivo, datos.version)) throw appMovilError('ARCHIVO_INVALIDO');
    if (!this.almacenamiento) throw appMovilError('DESCARGA_NO_CONFIGURADA');

    const subido = await this.almacenamiento.inspeccionar(datos.archivo);
    if (!subido) throw appMovilError('ARCHIVO_NO_SUBIDO');
    if (subido.tamanoBytes > TAMANO_MAXIMO_APK || !subido.cabecera.subarray(0, CABECERA_ZIP.length).equals(CABECERA_ZIP)) {
      await this.almacenamiento.eliminar(datos.archivo);
      throw appMovilError('ARCHIVO_INVALIDO');
    }

    const creada = await this.versiones.crear({
      version: datos.version,
      notas: (datos.notas ?? '').trim(),
      archivo: datos.archivo,
      tamanoBytes: subido.tamanoBytes,
      idUsuario: datos.idUsuario,
    });
    if (!creada) {
      await this.almacenamiento.eliminar(datos.archivo);
      throw appMovilError('VERSION_EXISTENTE');
    }
    return creada;
  }
}
