import { BlobSASPermissions, BlobServiceClient, ContainerClient, RestError, SASProtocol } from '@azure/storage-blob';
import type { AlmacenamientoApkPort } from '../../domain/ports/almacenamiento-apk.port';

// Margen para relojes desfasados: un SAS que "empieza" un poco antes no falla en el primer segundo
const MARGEN_INICIO_MS = 5 * 60 * 1000;
const TIPO_APK = 'application/vnd.android.package-archive';

/**
 * APKs en un contenedor privado de Azure Blob Storage (la misma cuenta de las evidencias). El navegador sube y descarga
 * directo con SAS de corta duración; firmarlos requiere una cadena de conexión con AccountKey. Para subir desde el panel
 * web, la cuenta necesita CORS que permita PUT desde el origen del Frontend.
 */
export class AlmacenamientoApkAzureBlob implements AlmacenamientoApkPort {
  private readonly contenedor: ContainerClient;

  constructor(connectionString: string, nombreContenedor: string) {
    this.contenedor = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(nombreContenedor);
  }

  // Crear y escribir solo ese archivo: con el enlace no se puede leer ni tocar otro
  urlSubida(archivo: string, expiraEn: Date): Promise<string> {
    return this.contenedor.getBlockBlobClient(archivo).generateSasUrl({
      permissions: BlobSASPermissions.parse('cw'),
      protocol: SASProtocol.Https,
      startsOn: new Date(Date.now() - MARGEN_INICIO_MS),
      expiresOn: expiraEn,
    });
  }

  urlDescarga(archivo: string, nombreDescarga: string, expiraEn: Date): Promise<string> {
    return this.contenedor.getBlobClient(archivo).generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      startsOn: new Date(Date.now() - MARGEN_INICIO_MS),
      expiresOn: expiraEn,
      contentType: TIPO_APK,
      contentDisposition: `attachment; filename="${nombreDescarga}"`,
    });
  }

  async inspeccionar(archivo: string): Promise<{ tamanoBytes: number; cabecera: Buffer } | null> {
    const blob = this.contenedor.getBlobClient(archivo);
    try {
      const { contentLength } = await blob.getProperties();
      const cabecera = contentLength ? await blob.downloadToBuffer(0, Math.min(4, contentLength)) : Buffer.alloc(0);
      return { tamanoBytes: contentLength ?? 0, cabecera };
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async eliminar(archivo: string): Promise<void> {
    await this.contenedor.getBlobClient(archivo).deleteIfExists();
  }
}
