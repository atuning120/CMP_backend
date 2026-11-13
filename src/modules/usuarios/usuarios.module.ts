import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioOrmEntity } from './infrastructure/persistence/orm-entities/usuario.orm-entity';
import { UsuarioPostgresqlRepository } from './infrastructure/persistence/repositories/usuario.postgresql-repository';
import {
  CUENTA_MICROSOFT_REPOSITORY,
  GESTION_USUARIOS_REPOSITORY,
  USUARIO_REPOSITORY,
} from './domain/repositories/usuario.repository.port';
import { UsuarioController } from './interface/http/controllers/usuario.controller';
import { PerfilController } from './interface/http/controllers/perfil.controller';
import { RECORRIDOS_REPOSITORY } from './domain/repositories/recorridos.repository.port';
import { RecorridosPostgresqlRepository } from './infrastructure/persistence/repositories/recorridos.postgresql-repository';
import { MarcarRecorridoVistoUseCase, ObtenerRecorridosUseCase } from './application/use-cases/recorridos-guiados.use-case';
import { ListarUsuariosUseCase } from './application/use-cases/listar-usuarios.use-case';
import { CambiarRolUsuarioUseCase } from './application/use-cases/cambiar-rol-usuario.use-case';
import { CrearUsuarioUseCase } from './application/use-cases/crear-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from './application/use-cases/cambiar-estado-usuario.use-case';
import { EditarUsuarioUseCase } from './application/use-cases/editar-usuario.use-case';
import { AdminPrincipalConfig } from './application/admin-principal';
import { AsegurarAdminPrincipalService } from './application/services/asegurar-admin-principal.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioOrmEntity])],
  controllers: [UsuarioController, PerfilController],
  providers: [
    AdminPrincipalConfig,
    AsegurarAdminPrincipalService,
    UsuarioPostgresqlRepository,
    { provide: USUARIO_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    { provide: CUENTA_MICROSOFT_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    { provide: GESTION_USUARIOS_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    ListarUsuariosUseCase,
    CambiarRolUsuarioUseCase,
    CrearUsuarioUseCase,
    CambiarEstadoUsuarioUseCase,
    EditarUsuarioUseCase,
    RecorridosPostgresqlRepository,
    { provide: RECORRIDOS_REPOSITORY, useExisting: RecorridosPostgresqlRepository },
    ObtenerRecorridosUseCase,
    MarcarRecorridoVistoUseCase,
  ],
  exports: [USUARIO_REPOSITORY, CUENTA_MICROSOFT_REPOSITORY],
})
export class UsuariosModule {}
