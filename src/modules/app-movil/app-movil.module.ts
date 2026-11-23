import { Module } from '@nestjs/common';
import { VersionesAppPublicoController } from './interface/http/controllers/versiones-app-publico.controller';
import { VersionesAppAdminController } from './interface/http/controllers/versiones-app-admin.controller';
import { ListarVersionesUseCase } from './application/use-cases/listar-versiones.use-case';
import { ObtenerDescargaUseCase } from './application/use-cases/obtener-descarga.use-case';
import { PrepararSubidaUseCase } from './application/use-cases/preparar-subida.use-case';
import { RegistrarVersionUseCase } from './application/use-cases/registrar-version.use-case';
import { EditarVersionUseCase } from './application/use-cases/editar-version.use-case';
import { EliminarVersionUseCase } from './application/use-cases/eliminar-version.use-case';
import { VersionAppPostgresqlRepository } from './infrastructure/persistence/version-app.postgresql-repository';
import { almacenamientoApkProvider } from './infrastructure/azure/almacenamiento-apk.provider';
import { VERSION_APP_REPOSITORY } from './domain/repositories/version-app.repository.port';

// Distribución de la app móvil (APK de Android): página pública de descarga con historial de versiones, que administra
// el ADMIN. Tabla VERSION_APP (migración 023) y archivos en el contenedor privado de Azure "apk"
@Module({
  controllers: [VersionesAppPublicoController, VersionesAppAdminController],
  providers: [
    { provide: VERSION_APP_REPOSITORY, useClass: VersionAppPostgresqlRepository },
    almacenamientoApkProvider,
    ListarVersionesUseCase,
    ObtenerDescargaUseCase,
    PrepararSubidaUseCase,
    RegistrarVersionUseCase,
    EditarVersionUseCase,
    EliminarVersionUseCase,
  ],
})
export class AppMovilModule {}
