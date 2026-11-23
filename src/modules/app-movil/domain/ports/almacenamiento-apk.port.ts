export const ALMACENAMIENTO_APK = Symbol('ALMACENAMIENTO_APK');

/**
 * Dónde viven los archivos .apk (contenedor privado). Ni la subida ni la descarga pasan por el Backend: entrega enlaces
 * firmados de corta duración y el navegador habla directo con el almacenamiento.
 */
export interface AlmacenamientoApkPort {
  // Enlace para que el navegador del administrador suba el archivo (solo crear/escribir ese archivo)
  urlSubida(archivo: string, expiraEn: Date): Promise<string>;
  // Enlace de solo lectura; el navegador guarda el archivo como `nombreDescarga`
  urlDescarga(archivo: string, nombreDescarga: string, expiraEn: Date): Promise<string>;
  // Tamaño y primeros bytes del archivo subido, o null si no existe
  inspeccionar(archivo: string): Promise<{ tamanoBytes: number; cabecera: Buffer } | null>;
  eliminar(archivo: string): Promise<void>;
}
