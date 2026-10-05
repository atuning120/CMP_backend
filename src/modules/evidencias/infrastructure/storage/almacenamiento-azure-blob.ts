import { Logger } from '@nestjs/common';
import { BlobServiceClient, ContainerClient, RestError } from '@azure/storage-blob';
import type { AlmacenamientoArchivosPort } from '../../domain/ports/almacenamiento-archivos.port';

/**
 * Fotos en Azure Blob Storage, en un contenedor privado (sin acceso anónimo). Solo el Backend
 * accede con la cadena de conexión; la app nunca la conoce.
 */
export class AlmacenamientoAzureBlob implements AlmacenamientoArchivosPort {
  private readonly logger = new Logger(AlmacenamientoAzureBlob.name);
  private readonly contenedor: ContainerClient;

  constructor(connectionString: string, nombreContenedor: string) {
    this.contenedor = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(nombreContenedor);
  }

  // Se llama al arrancar: confirma credenciales y contenedor, sin impedir que el Backend inicie
  async verificarConexion(): Promise<void> {
    try {
      const existe = await this.contenedor.exists();
      if (existe) {
        this.logger.log(`Evidencias en Azure Blob Storage: ${this.contenedor.accountName}/${this.contenedor.containerName}`);
      } else {
        this.logger.error(`El contenedor "${this.contenedor.containerName}" no existe en la cuenta ${this.contenedor.accountName}`);
      }
    } catch (error) {
      this.logger.error(`No se pudo conectar a Azure Blob Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async guardar(clave: string, contenido: Buffer, mimeType: string): Promise<void> {
    await this.contenedor.getBlockBlobClient(clave).uploadData(contenido, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      return await this.contenedor.getBlobClient(clave).downloadToBuffer();
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 404) return null;
      throw error;
    }
  }
}
