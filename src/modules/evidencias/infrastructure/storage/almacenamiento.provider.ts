import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALMACENAMIENTO_ARCHIVOS } from '../../domain/ports/almacenamiento-archivos.port';
import { AlmacenamientoAzureBlob } from './almacenamiento-azure-blob';
import { AlmacenamientoLocal } from './almacenamiento-local';

/**
 * Con AZURE_STORAGE_CONNECTION_STRING definido se usa Azure Blob Storage (contenedor
 * AZURE_STORAGE_CONTAINER, por defecto "evidencias"); sin él, disco local (desarrollo y tests).
 */
export const almacenamientoProvider: Provider = {
  provide: ALMACENAMIENTO_ARCHIVOS,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (!connectionString) {
      new Logger('Almacenamiento').warn('AZURE_STORAGE_CONNECTION_STRING no definido: las evidencias se guardan en disco local');
      return new AlmacenamientoLocal(config);
    }
    const azure = new AlmacenamientoAzureBlob(connectionString, config.get<string>('AZURE_STORAGE_CONTAINER', 'evidencias'));
    await azure.verificarConexion();
    return azure;
  },
};
