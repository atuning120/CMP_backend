import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALMACENAMIENTO_APK } from '../../domain/ports/almacenamiento-apk.port';
import { AlmacenamientoApkAzureBlob } from './almacenamiento-apk.azure-blob';

/**
 * Con AZURE_STORAGE_CONNECTION_STRING (la misma de las evidencias) las APK van al contenedor AZURE_STORAGE_CONTAINER_APK,
 * por defecto "apk". Sin ella (desarrollo local) no hay subida ni descarga: null, y los casos de uso responden 503.
 */
export const almacenamientoApkProvider: Provider = {
  provide: ALMACENAMIENTO_APK,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (!connectionString) return null;
    return new AlmacenamientoApkAzureBlob(connectionString, config.get<string>('AZURE_STORAGE_CONTAINER_APK', 'apk'));
  },
};
